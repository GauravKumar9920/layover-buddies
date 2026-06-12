-- ============================================================================
-- DEPOSITS_HELD STUCK-STATE SWEEP
-- ============================================================================
-- Fixes APP_REVIEW.md §1.3a (2026-06-10).
--
-- `deposits_held` is written by the deposit webhook immediately before
-- `awaiting_balance` — two separate UPDATEs (see _shared/depositCapture.ts).
-- If the Edge function dies between the two writes, the booking is frozen in
-- deposits_held with no outgoing events and no way out. This sweep advances
-- any booking that has sat in deposits_held for >2 minutes and whose two
-- deposits really are held.
--
-- Rows in deposits_held WITHOUT both deposits held should not exist (the state
-- is only written once both are held); they are surfaced as a WARNING for ops
-- instead of being advanced blindly.
-- ============================================================================

CREATE OR REPLACE FUNCTION cron_deposits_held_sweep()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec        record;
  v_held_count integer;
BEGIN
  FOR v_rec IN
    SELECT id
      FROM bookings
     WHERE status = 'deposits_held'
       AND updated_at < now() - interval '2 minutes'
     ORDER BY updated_at
  LOOP
    BEGIN
      SELECT count(*) INTO v_held_count
        FROM deposits
       WHERE booking_id = v_rec.id
         AND status = 'held';

      IF v_held_count = 2 THEN
        UPDATE bookings
           SET status = 'awaiting_balance'
         WHERE id = v_rec.id
           AND status = 'deposits_held';  -- re-check under the implicit row lock
        RAISE LOG 'cron_deposits_held_sweep: advanced booking % to awaiting_balance', v_rec.id;
      ELSE
        -- Should be unreachable: deposits_held is only written when both
        -- deposits are held. Surface it for ops instead of guessing.
        RAISE WARNING 'cron_deposits_held_sweep: booking % is deposits_held with % held deposit(s) — needs manual review',
          v_rec.id, v_held_count;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cron_deposits_held_sweep: failed for booking %: %', v_rec.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION cron_deposits_held_sweep() TO service_role, postgres;

-- Schedule every 5 minutes. Idempotent: unschedule first to avoid duplicates.
DO $$ BEGIN
  PERFORM cron.unschedule('cron_deposits_held_sweep');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('cron_deposits_held_sweep', '*/5 * * * *', 'SELECT cron_deposits_held_sweep();');
