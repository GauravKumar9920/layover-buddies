-- ============================================================================
-- RECONCILIATION FUNCTION — Phase 4
-- ============================================================================
-- SECURITY DEFINER plpgsql function that runs atomically when the buddy
-- submits their expense proofs. Mirrors mobile/lib/booking/reconciliationSnapshot.ts
-- exactly — the two implementations must produce identical numbers for the
-- canonical fixture (buddyFee=₹2,000, itin=₹3,000, buffer=₹600, spend=₹3,400
-- → buddyNet=₹2,032.50, travelerRefund=₹700).
--
-- Steps (all in one transaction with FOR UPDATE on bookings):
--   1. Read latest agreement for fee/fund/buffer snapshot.
--   2. Sum expense_proofs.amount_paise and captured top-ups for the booking.
--   3. Compute the snapshot (mirrors TS formula).
--   4. INSERT two payout_dispatches rows: buddy_fee_final + traveler_refund.
--   5. UPDATE deposits SET status='refunded' for both sides.
--   6. UPDATE bookings SET reconciled_at=now().
-- Returns the full snapshot jsonb.
--
-- Idempotent: subsequent calls are no-ops (UPDATE on already-refunded deposits
-- matches 0 rows; INSERT guarded by the unique partial index).
-- ============================================================================

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
  c_platform_rate    constant numeric := 0.875;         -- 1 - 12.5%
  c_tds_rate         constant numeric := 0.01;          -- 1% TDS
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
  v_trip_pot      := v_agreement.itinerary_fund_paise + v_agreement.buffer_paise + v_captured_topups;
  v_capped_spend  := LEAST(v_declared_spend, v_trip_pot);             -- §12 case 5 cap
  v_unused_buffer := v_trip_pot - v_capped_spend;

  v_after_platform := FLOOR(v_agreement.buddy_fee_paise * c_platform_rate)::integer;
  v_tds            := ROUND(v_after_platform * c_tds_rate)::integer;
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

-- ─── Fill cron function bodies that complete the trip lifecycle ─────────────
-- These were created as stubs in migration 100400.

CREATE OR REPLACE FUNCTION cron_proofs_overdue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id   uuid;
  v_buddy_id     uuid;
BEGIN
  FOR v_booking_id, v_buddy_id IN
    SELECT b.id, b.guide_id
      FROM bookings b
     WHERE b.status = 'awaiting_proofs'
       AND b.proofs_due_at < now()
     ORDER BY b.proofs_due_at
  LOOP
    BEGIN
      INSERT INTO notifications
        (booking_id, recipient_user_id, kind, payload)
      VALUES
        (v_booking_id, v_buddy_id, 'proofs_overdue',
         jsonb_build_object('overdue_since', now()))
      ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cron_proofs_overdue: failed for booking %: %', v_booking_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION cron_rating_link_send()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id   uuid;
  v_traveler_id  uuid;
BEGIN
  FOR v_booking_id, v_traveler_id IN
    SELECT b.id, b.traveler_id
      FROM bookings b
     WHERE b.status = 'completed'
       AND b.rating_link_sent_at IS NULL
       AND b.completed_at < now() - interval '3 hours'
     ORDER BY b.completed_at
  LOOP
    BEGIN
      INSERT INTO notifications
        (booking_id, recipient_user_id, kind, payload)
      VALUES
        (v_booking_id, v_traveler_id, 'rating_prompt', '{}')
      ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING;

      UPDATE bookings
         SET rating_link_sent_at = now()
       WHERE id = v_booking_id
         AND rating_link_sent_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cron_rating_link_send: failed for booking %: %', v_booking_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION cron_proofs_overdue()    TO service_role, postgres;
GRANT EXECUTE ON FUNCTION cron_rating_link_send()  TO service_role, postgres;

-- ─── Storage bucket: expense-proofs ────────────────────────────────────────
-- The bucket itself is created via Supabase Storage API or the dashboard;
-- we set up the RLS policies here.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('expense-proofs', 'expense-proofs', false)
  ON CONFLICT (id) DO NOTHING;

-- Buddy can upload into expense-proofs/<booking_id>/...
-- Both parties on a booking can read.
DO $$ BEGIN
  DROP POLICY IF EXISTS expense_proofs_buddy_insert ON storage.objects;
  CREATE POLICY expense_proofs_buddy_insert
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'expense-proofs'
      AND EXISTS (
        SELECT 1 FROM bookings b
         WHERE b.guide_id = auth.uid()
           AND (storage.foldername(name))[1] = b.id::text
      )
    );
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS expense_proofs_party_select ON storage.objects;
  CREATE POLICY expense_proofs_party_select
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'expense-proofs'
      AND EXISTS (
        SELECT 1 FROM bookings b
         WHERE (b.traveler_id = auth.uid() OR b.guide_id = auth.uid())
           AND (storage.foldername(name))[1] = b.id::text
      )
    );
EXCEPTION WHEN undefined_table THEN NULL; END $$;
