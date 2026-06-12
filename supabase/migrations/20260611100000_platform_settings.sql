-- ============================================================================
-- PLATFORM SETTINGS — runtime-configurable pricing (early-access mode)
-- ============================================================================
-- Detour launches free: travelers pay only the buddy fee + itinerary fund
-- (+ refundable ₹500 deposit and 20% buffer). All platform charges —
-- platform-up/down fees, commission, GST, TDS, late fee — are zeroed while
-- `early_access_mode = true`. The admin panel flips the switch and edits the
-- individual rates when monetisation starts.
--
-- Design:
--   1. `platform_settings` — single-row table (id = 1 enforced by CHECK).
--      Readable by everyone (rates are public-facing pricing, not secrets);
--      writable ONLY via service role (the admin panel) — no RLS write policy.
--   2. `get_effective_rates()` — the one place the early-access zeroing rule
--      lives. Clients call it via RPC; cron/pg functions call it directly.
--   3. Rate columns on `agreements` — the rates in force are SNAPSHOTTED into
--      each agreement at draft time, so flipping a toggle never changes the
--      economics of an agreement someone already signed.
--   4. `compute_reconciliation_tx` + `cron_late_fee_assess` are re-created to
--      read rates from the agreement row / settings instead of constants.
-- ============================================================================

-- ── 1. Settings table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id                      smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  early_access_mode       boolean       NOT NULL DEFAULT true,
  -- Rates below are the values used once early_access_mode is switched OFF.
  platform_fee_up_rate    numeric(5,4)  NOT NULL DEFAULT 0.125  CHECK (platform_fee_up_rate   >= 0 AND platform_fee_up_rate   <= 1),
  platform_fee_down_rate  numeric(5,4)  NOT NULL DEFAULT 0.125  CHECK (platform_fee_down_rate >= 0 AND platform_fee_down_rate <= 1),
  commission_rate         numeric(5,4)  NOT NULL DEFAULT 0.25   CHECK (commission_rate        >= 0 AND commission_rate        <= 1),
  gst_rate                numeric(5,4)  NOT NULL DEFAULT 0.05   CHECK (gst_rate               >= 0 AND gst_rate               <= 1),
  tds_rate                numeric(5,4)  NOT NULL DEFAULT 0.01   CHECK (tds_rate               >= 0 AND tds_rate               <= 1),
  late_fee_paise          integer       NOT NULL DEFAULT 100000 CHECK (late_fee_paise >= 0),
  updated_at              timestamptz   NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Pricing config is public information (the app shows it to every user before
-- they pay). Reads allowed for everyone; writes only through service role.
DO $$ BEGIN
  CREATE POLICY platform_settings_public_read
    ON platform_settings FOR SELECT
    TO anon, authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Effective rates — the single source of the early-access rule ─────────
-- Returns the rates that should apply to anything priced *right now*.
-- When early_access_mode is on every platform charge is zero.
CREATE OR REPLACE FUNCTION get_effective_rates()
RETURNS TABLE (
  early_access_mode      boolean,
  platform_fee_up_rate   numeric,
  platform_fee_down_rate numeric,
  commission_rate        numeric,
  gst_rate               numeric,
  tds_rate               numeric,
  late_fee_paise         integer
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    s.early_access_mode,
    CASE WHEN s.early_access_mode THEN 0 ELSE s.platform_fee_up_rate   END,
    CASE WHEN s.early_access_mode THEN 0 ELSE s.platform_fee_down_rate END,
    CASE WHEN s.early_access_mode THEN 0 ELSE s.commission_rate        END,
    CASE WHEN s.early_access_mode THEN 0 ELSE s.gst_rate               END,
    CASE WHEN s.early_access_mode THEN 0 ELSE s.tds_rate               END,
    CASE WHEN s.early_access_mode THEN 0 ELSE s.late_fee_paise         END
  FROM platform_settings s
  WHERE s.id = 1;
$$;

GRANT EXECUTE ON FUNCTION get_effective_rates() TO anon, authenticated, service_role;

-- ── 3. Snapshot the rates into agreements ────────────────────────────────────
-- Existing rows get the historical defaults (12.5% / 12.5% / 1%) — exactly the
-- behaviour they were signed under. New drafts write the effective rates.
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS platform_fee_up_rate   numeric(5,4) NOT NULL DEFAULT 0.125,
  ADD COLUMN IF NOT EXISTS platform_fee_down_rate numeric(5,4) NOT NULL DEFAULT 0.125,
  ADD COLUMN IF NOT EXISTS tds_rate               numeric(5,4) NOT NULL DEFAULT 0.01;

-- ── 4. Reconciliation uses the agreement's snapshotted rates ─────────────────
-- Identical to 20260512100200 except c_platform_rate / c_tds_rate constants are
-- replaced by the agreement row's platform_fee_down_rate / tds_rate.
CREATE OR REPLACE FUNCTION compute_reconciliation_tx(
  p_booking_id uuid
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_booking          bookings%ROWTYPE;
  v_agreement        agreements%ROWTYPE;
  v_declared_spend   integer;
  v_captured_topups  integer;
  v_trip_pot         integer;
  v_capped_spend     integer;
  v_unused_buffer    integer;
  v_after_platform   integer;
  v_tds              integer;
  v_buddy_net        integer;
  v_traveler_refund  integer;
  v_snapshot         jsonb;
  c_deposit_paise    constant integer := 50000;         -- ₹500
BEGIN
  -- ── 1. Lock booking ───────────────────────────────────────────────────────
  SELECT * INTO v_booking
    FROM bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- ── 2. Load latest agreement ──────────────────────────────────────────────
  SELECT * INTO v_agreement
    FROM agreements
   WHERE booking_id = p_booking_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No agreement found for booking %', p_booking_id;
  END IF;

  -- ── 3. Compute declared spend ─────────────────────────────────────────────
  SELECT COALESCE(SUM(amount_paise), 0)
    INTO v_declared_spend
    FROM expense_proofs
   WHERE booking_id = p_booking_id;

  -- ── 4. Compute captured top-ups ───────────────────────────────────────────
  SELECT COALESCE(SUM(amount_paise), 0)
    INTO v_captured_topups
    FROM payment_events
   WHERE booking_id = p_booking_id
     AND kind = 'top_up'
     AND status = 'captured';

  -- ── 5. Snapshot math (mirrors reconciliationSnapshot.ts exactly) ──────────
  -- Rates come from the agreement row — whatever was in force when it was
  -- drafted — NOT from current platform_settings. Early-access agreements
  -- carry 0 rates, so the buddy receives the full fee and no TDS is withheld.
  v_trip_pot      := v_agreement.itinerary_fund_paise + v_agreement.buffer_paise + v_captured_topups;
  v_capped_spend  := LEAST(v_declared_spend, v_trip_pot);             -- §12 case 5 cap
  v_unused_buffer := v_trip_pot - v_capped_spend;

  v_after_platform := FLOOR(v_agreement.buddy_fee_paise * (1 - v_agreement.platform_fee_down_rate))::integer;
  v_tds            := ROUND(v_after_platform * v_agreement.tds_rate)::integer;
  v_buddy_net      := v_after_platform - v_tds + c_deposit_paise - v_unused_buffer;
  v_traveler_refund:= v_unused_buffer + c_deposit_paise;

  v_snapshot := jsonb_build_object(
    'tripPotPaise',               v_trip_pot,
    'declaredSpendCappedPaise',   v_capped_spend,
    'unusedBufferPaise',          v_unused_buffer,
    'buddyFeeAfterPlatformPaise', v_after_platform,
    'tdsPaise',                   v_tds,
    'buddyNetPaise',              v_buddy_net,
    'travelerRefundPaise',        v_traveler_refund
  );

  -- ── 6. INSERT payout_dispatches (idempotent via unique partial index) ──────
  INSERT INTO payout_dispatches
    (booking_id, kind, recipient_user_id,
     gross_paise, tds_paise, buffer_clawback_paise, deposit_component_paise, net_paise)
  VALUES
    (p_booking_id, 'buddy_fee_final', v_booking.guide_id,
     v_after_platform, v_tds, v_unused_buffer, c_deposit_paise, v_buddy_net)
  ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING;

  INSERT INTO payout_dispatches
    (booking_id, kind, recipient_user_id,
     gross_paise, deposit_component_paise, net_paise)
  VALUES
    (p_booking_id, 'traveler_refund', v_booking.traveler_id,
     v_traveler_refund, c_deposit_paise, v_traveler_refund)
  ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING;

  -- ── 7. Refund deposits ─────────────────────────────────────────────────────
  UPDATE deposits
     SET status = 'refunded'
   WHERE booking_id = p_booking_id
     AND status = 'held';

  -- ── 8. Mark reconciled ────────────────────────────────────────────────────
  UPDATE bookings
     SET reconciled_at = now()
   WHERE id = p_booking_id
     AND reconciled_at IS NULL;  -- idempotency guard

  RETURN v_snapshot;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_reconciliation_tx(uuid) TO service_role;

-- ── 5. Late-fee cron reads the configured fee ────────────────────────────────
-- Identical to 20260512100500 except the ₹1,000 constant comes from
-- get_effective_rates(). When the effective fee is 0 (early access) the status
-- still flips at T-72h — the payment deadline and T-12h auto-cancel machinery
-- must keep running — but no fee is charged.
CREATE OR REPLACE FUNCTION cron_late_fee_assess()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
  v_late_fee   integer;
BEGIN
  SELECT r.late_fee_paise INTO v_late_fee FROM get_effective_rates() r;
  v_late_fee := COALESCE(v_late_fee, 100000);

  FOR v_booking_id IN
    SELECT b.id
      FROM bookings b
      CROSS JOIN LATERAL (
        SELECT a.trip_starts_at
          FROM agreements a
         WHERE a.booking_id = b.id
         ORDER BY a.created_at DESC
         LIMIT 1
      ) latest_a
     WHERE b.status = 'awaiting_balance'
       AND b.late_fee_assessed_at IS NULL
       AND latest_a.trip_starts_at - now() <= interval '72 hours'
       AND latest_a.trip_starts_at > now()     -- don't assess fees for already-started trips
     ORDER BY latest_a.trip_starts_at
  LOOP
    BEGIN
      UPDATE bookings
         SET status               = 'late_fee_due',
             late_fee_paise       = v_late_fee,
             late_fee_assessed_at = now()
       WHERE id = v_booking_id
         AND status = 'awaiting_balance'  -- double-guard against race
         AND late_fee_assessed_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cron_late_fee_assess: failed for booking %: %', v_booking_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION cron_late_fee_assess() TO service_role, postgres;
