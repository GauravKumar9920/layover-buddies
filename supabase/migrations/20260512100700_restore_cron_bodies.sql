-- ============================================================================
-- RESTORE CRON BODIES clobbered by migration 100400
-- ============================================================================
-- Migrations 100200 and 100300 filled in real bodies for four cron functions.
-- Migration 100400 (pg_cron infrastructure) ran AFTER them and overwrote those
-- real bodies with RETURN; stubs, because it used CREATE OR REPLACE FUNCTION
-- unconditionally.
--
-- This migration re-applies the four real bodies verbatim from their owning
-- stage migrations so they are the final definition after all migrations run.
--
-- Affected functions:
--   cron_no_pay_cancel        (filled by 100300, clobbered by 100400)
--   cron_deposit_window_expire (filled by 100300, clobbered by 100400)
--   cron_proofs_overdue       (filled by 100200, clobbered by 100400)
--   cron_rating_link_send     (filled by 100200, clobbered by 100400)
-- ============================================================================

-- ── cron_no_pay_cancel ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cron_no_pay_cancel()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec bookings%ROWTYPE;
BEGIN
  FOR v_rec IN
    SELECT b.*
      FROM bookings b
      JOIN agreements a ON a.booking_id = b.id
     WHERE b.status = 'late_fee_due'
       AND a.trip_starts_at - now() <= interval '12 hours'
       AND a.trip_starts_at - now() > interval '-24 hours'  -- safety: don't process very old rows
     ORDER BY a.trip_starts_at
  LOOP
    BEGIN
      PERFORM compute_cancellation_resolution_tx(v_rec.id, 't_minus_12_no_pay', 'system');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cron_no_pay_cancel: failed for booking %: %', v_rec.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- ── cron_deposit_window_expire ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cron_deposit_window_expire()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec bookings%ROWTYPE;
BEGIN
  FOR v_rec IN
    SELECT *
      FROM bookings
     WHERE status = 'awaiting_deposits'
       AND now() - created_at > interval '24 hours'
     ORDER BY created_at
  LOOP
    BEGIN
      PERFORM compute_cancellation_resolution_tx(v_rec.id, 'deposit_window_expired', 'system');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cron_deposit_window_expire: failed for booking %: %', v_rec.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- ── cron_proofs_overdue ──────────────────────────────────────────────────────

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

-- ── cron_rating_link_send ────────────────────────────────────────────────────

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

GRANT EXECUTE ON FUNCTION cron_no_pay_cancel()         TO service_role, postgres;
GRANT EXECUTE ON FUNCTION cron_deposit_window_expire() TO service_role, postgres;
GRANT EXECUTE ON FUNCTION cron_proofs_overdue()        TO service_role, postgres;
GRANT EXECUTE ON FUNCTION cron_rating_link_send()      TO service_role, postgres;
