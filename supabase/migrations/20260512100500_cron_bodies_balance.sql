-- ============================================================================
-- CRON FUNCTION BODIES — Stage C: balance + late-fee crons
-- ============================================================================
-- Fills in the three stub cron functions created in migration 100400 that
-- depend on the balance/agreement flow. These are filled here (not in 100400)
-- to avoid forward-reference errors — the cron bodies need the bookings +
-- agreements schema from earlier migrations plus the pg_cron extension from
-- 100400.
--
-- Functions filled in:
--   cron_balance_reminder      — inserts notification rows at T-84/48/24/18h
--   cron_late_fee_assess       — flips awaiting_balance → late_fee_due at T-72h
--   cron_t_minus_12_balance_paid — flips balance_paid → trip_ready at T-12h
--
-- cron_no_pay_cancel and cron_deposit_window_expire were filled in migration
-- 100300 (they depend on compute_cancellation_resolution_tx).
-- ============================================================================

-- ─── cron_balance_reminder ─────────────────────────────────────────────────
-- Inserts notifications rows for bookings approaching the balance deadline.
-- Threshold hours relative to trip start: 84, 48, 24, 18.
-- Idempotent: guarded by uniq_notifications_booking_kind index.

CREATE OR REPLACE FUNCTION cron_balance_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id   uuid;
  v_traveler_id  uuid;
  v_hours_until  numeric;
  v_threshold    integer;
  v_kind         text;
BEGIN
  FOR v_booking_id, v_traveler_id, v_hours_until IN
    SELECT b.id, b.traveler_id,
           EXTRACT(EPOCH FROM (a.trip_starts_at - now())) / 3600.0
      FROM bookings b
      JOIN agreements a ON a.booking_id = b.id
     WHERE b.status = 'awaiting_balance'
       AND a.trip_starts_at > now()
       AND a.trip_starts_at - now() <= interval '84 hours'
     ORDER BY a.trip_starts_at
  LOOP
    -- Determine which threshold this booking has crossed.
    FOREACH v_threshold IN ARRAY ARRAY[18, 24, 48, 84]
    LOOP
      IF v_hours_until <= v_threshold THEN
        v_kind := 'balance_reminder_t' || v_threshold;
        BEGIN
          INSERT INTO notifications
            (booking_id, recipient_user_id, kind, payload)
          VALUES
            (v_booking_id, v_traveler_id, v_kind,
             jsonb_build_object('hours_until_trip', round(v_hours_until, 1)))
          ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'cron_balance_reminder: notification insert failed for % / %: %',
            v_booking_id, v_kind, SQLERRM;
        END;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ─── cron_late_fee_assess ──────────────────────────────────────────────────
-- For bookings in awaiting_balance where trip_starts_at <= now() + 72h:
-- Flip status to late_fee_due, set late_fee_paise, record assessed_at.
-- Only runs if late_fee_assessed_at IS NULL (idempotent via the partial index).

CREATE OR REPLACE FUNCTION cron_late_fee_assess()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  FOR v_booking_id IN
    SELECT b.id
      FROM bookings b
      JOIN agreements a ON a.booking_id = b.id
     WHERE b.status = 'awaiting_balance'
       AND b.late_fee_assessed_at IS NULL
       AND a.trip_starts_at - now() <= interval '72 hours'
       AND a.trip_starts_at > now()     -- don't assess fees for already-started trips
     ORDER BY a.trip_starts_at
  LOOP
    BEGIN
      UPDATE bookings
         SET status               = 'late_fee_due',
             late_fee_paise       = 100000,          -- ₹1,000 constant
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

-- ─── cron_t_minus_12_balance_paid ─────────────────────────────────────────
-- For bookings in balance_paid where trip_starts_at <= now() + 12h:
-- Flip status to trip_ready and generate a QR token.

CREATE OR REPLACE FUNCTION cron_t_minus_12_balance_paid()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  FOR v_booking_id IN
    SELECT b.id
      FROM bookings b
      JOIN agreements a ON a.booking_id = b.id
     WHERE b.status = 'balance_paid'
       AND a.trip_starts_at - now() <= interval '12 hours'
       AND a.trip_starts_at > now() - interval '24 hours'  -- don't advance very stale rows
     ORDER BY a.trip_starts_at
  LOOP
    BEGIN
      UPDATE bookings
         SET status        = 'trip_ready',
             trip_qr_token = gen_random_uuid()::text
       WHERE id = v_booking_id
         AND status = 'balance_paid';  -- double-guard
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cron_t_minus_12_balance_paid: failed for booking %: %', v_booking_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION cron_balance_reminder()        TO service_role, postgres;
GRANT EXECUTE ON FUNCTION cron_late_fee_assess()         TO service_role, postgres;
GRANT EXECUTE ON FUNCTION cron_t_minus_12_balance_paid() TO service_role, postgres;

-- Add trip_qr_token column to bookings (used by cron and qr-scan Edge fn).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trip_qr_token text;
-- Small index for the QR validation lookup in qr-scan Edge fn.
CREATE INDEX IF NOT EXISTS idx_bookings_qr_token ON bookings(trip_qr_token) WHERE trip_qr_token IS NOT NULL;
