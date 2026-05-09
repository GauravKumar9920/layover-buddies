-- ============================================================================
-- PG_CRON INFRASTRUCTURE + NOTIFICATIONS TABLE (Migration 3 of 5, Phase 3+4)
-- ============================================================================
-- Sets up the recurring jobs that drive Phase 3+4 backend-only state
-- transitions and reminders. Function bodies are stubs in this migration —
-- they are filled in by later migrations once their dependencies (resolvers,
-- snapshot RPCs) exist:
--
--   Stage B (20260512100300) — cron_no_pay_cancel, cron_deposit_window_expire
--   Stage C (filled in this PR) — cron_late_fee_assess, cron_balance_reminder,
--                                 cron_t_minus_12_balance_paid
--   Stage D (filled in this PR) — cron_proofs_overdue, cron_rating_link_send
--
-- Stubs return immediately (RETURN; in plpgsql) so scheduled jobs do nothing
-- until their owning stage fills the body via CREATE OR REPLACE FUNCTION.
-- ============================================================================

-- Enable the extension. Idempotent.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─────────────────────────────────────────────────────────────────
-- notifications table — extend the Phase 1 table (initial_schema.sql)
-- with Phase 3+4 columns instead of re-creating it.
--
-- initial_schema has: id, user_id (NOT NULL), type (enum, NOT NULL),
--   title (NOT NULL), body, data, is_read, created_at
--
-- Phase 3+4 needs:    booking_id, recipient_user_id, kind (text), payload,
--   sent_at, read_at, dismissed_at
--
-- We ADD the new columns and make the old Phase-1 NOT NULL columns nullable
-- so cron-inserted rows (which have no title/type/user_id) don't violate
-- constraints. Phase 5 push-notification code will populate those columns.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS booking_id        uuid REFERENCES bookings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES users(id),
  -- text kind replaces the enum; richer vocabulay without enum migrations:
  --   'balance_reminder_84h', 'balance_reminder_48h', 'balance_reminder_24h', 'balance_reminder_18h',
  --   'late_fee_assessed', 'no_pay_cancelled', 'proofs_overdue', 'rating_link', 'top_up_request'
  ADD COLUMN IF NOT EXISTS kind              text,
  ADD COLUMN IF NOT EXISTS payload           jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sent_at           timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS read_at           timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at      timestamptz;

-- Make Phase-1 columns nullable so cron rows (no push-notification fields) are valid.
ALTER TABLE notifications
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN type    DROP NOT NULL,
  ALTER COLUMN title   DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_user_id, sent_at DESC);

-- Idempotency: each (booking_id, kind) pair is unique so cron re-runs don't
-- spam multiple rows. Some kinds are emitted by edge fns and want to skip
-- this constraint — they leave booking_id NULL or use a kind suffix.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_booking_kind
  ON notifications(booking_id, kind, recipient_user_id)
  WHERE booking_id IS NOT NULL;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_read_own ON notifications;
CREATE POLICY notifications_read_own ON notifications
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- Cron function stubs
-- Each is created as SECURITY DEFINER so it can write to bookings/notifications
-- under the postgres role (cron jobs run as the user who scheduled them).
-- Bodies are placeholders that RETURN; — filled in by later stage migrations.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cron_balance_reminder()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Stage C will fill: scan awaiting_balance bookings hitting T-84/48/24/18h,
  -- insert notification rows. Idempotent on (booking_id, kind, recipient).
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION cron_late_fee_assess()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Stage C will fill: for awaiting_balance + agreement.trip_starts_at - now() <= 72h
  -- + late_fee_assessed_at IS NULL: set status='late_fee_due', late_fee_paise=100000.
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION cron_no_pay_cancel()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Stage B will fill: for late_fee_due + trip_starts_at - now() <= 12h:
  -- call compute_cancellation_resolution_tx(id, 't_minus_12_no_pay', 'system').
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION cron_t_minus_12_balance_paid()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Stage C will fill: for balance_paid + trip_starts_at - now() <= 12h:
  -- set status='trip_ready', generate trip_qr_token = gen_random_uuid().
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION cron_deposit_window_expire()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Stage B will fill: for awaiting_deposits + age > 24h:
  -- call compute_cancellation_resolution_tx(id, 'deposit_window_expired', 'system').
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION cron_proofs_overdue()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Stage D will fill: for awaiting_proofs + now() > proofs_due_at:
  -- insert ops review notification. Auto-transition to disputed is flag-gated.
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION cron_rating_link_send()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Stage D will fill: for completed + rating_link_sent_at IS NULL +
  -- completed_at < now() - 3h: insert notification, set rating_link_sent_at.
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION cron_balance_reminder()         TO postgres, service_role;
GRANT EXECUTE ON FUNCTION cron_late_fee_assess()          TO postgres, service_role;
GRANT EXECUTE ON FUNCTION cron_no_pay_cancel()            TO postgres, service_role;
GRANT EXECUTE ON FUNCTION cron_t_minus_12_balance_paid()  TO postgres, service_role;
GRANT EXECUTE ON FUNCTION cron_deposit_window_expire()    TO postgres, service_role;
GRANT EXECUTE ON FUNCTION cron_proofs_overdue()           TO postgres, service_role;
GRANT EXECUTE ON FUNCTION cron_rating_link_send()         TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────
-- Schedule the jobs.
-- pg_cron uses standard 5-field cron syntax. All jobs run as `postgres`
-- (the role that owns the SECURITY DEFINER functions).
--
-- Schedules — kept low-frequency for v1 to limit log volume:
--   balance_reminder         hourly
--   late_fee_assess          hourly
--   no_pay_cancel            hourly
--   t_minus_12_balance_paid  hourly
--   deposit_window_expire    hourly
--   proofs_overdue           hourly
--   rating_link_send         every 5 minutes
-- ─────────────────────────────────────────────────────────────────

-- Helper: idempotently schedule a job by jobname.
-- cron.schedule() returns a jobid; we ignore it. cron.unschedule(name)
-- returns boolean; we ignore the result if the job didn't exist.
DO $$ BEGIN
  PERFORM cron.unschedule('cron_balance_reminder');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cron_balance_reminder',         '0 * * * *',  'SELECT cron_balance_reminder();');

DO $$ BEGIN PERFORM cron.unschedule('cron_late_fee_assess');         EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cron_late_fee_assess',          '5 * * * *',  'SELECT cron_late_fee_assess();');

DO $$ BEGIN PERFORM cron.unschedule('cron_no_pay_cancel');           EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cron_no_pay_cancel',            '10 * * * *', 'SELECT cron_no_pay_cancel();');

DO $$ BEGIN PERFORM cron.unschedule('cron_t_minus_12_balance_paid'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cron_t_minus_12_balance_paid',  '15 * * * *', 'SELECT cron_t_minus_12_balance_paid();');

DO $$ BEGIN PERFORM cron.unschedule('cron_deposit_window_expire');   EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cron_deposit_window_expire',    '20 * * * *', 'SELECT cron_deposit_window_expire();');

DO $$ BEGIN PERFORM cron.unschedule('cron_proofs_overdue');          EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cron_proofs_overdue',           '25 * * * *', 'SELECT cron_proofs_overdue();');

-- Rating-link cron runs more frequently (every 5 min) so the T+3h cutoff
-- is hit promptly after a trip ends.
DO $$ BEGIN PERFORM cron.unschedule('cron_rating_link_send');        EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cron_rating_link_send',         '*/5 * * * *','SELECT cron_rating_link_send();');
