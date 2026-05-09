-- ============================================================================
-- PHASE 3 + 4 — SCHEMA ADDITIONS (Migration 1 of 5)
-- ============================================================================
-- Adds columns and enum values needed by:
--   - Cancellation truth-table resolver (Phase 3)
--   - Late-fee accrual + balance flow (Phase 3)
--   - Trip-pot release + reconciliation (Phase 4)
--   - Buddy payout VPA + ban tracking (Phase 4)
--
-- All additions are additive and idempotent. No existing rows are touched.
-- The cron-job partial indexes here are status-filtered for fast scans by
-- the pg_cron jobs added in migration 20260512100400.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────
-- bookings — cancellation, late-fee, trip-lifecycle bookkeeping
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at                 timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by_user_id         uuid REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_resolution_jsonb   jsonb;
-- text rather than enum so we can add new triggers without enum migrations:
--   'voluntary' | 't_minus_12_no_pay' | 'force_majeure_verified' | 'deposit_window_expired'
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_trigger_event   text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_reason             text;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_fee_paise               integer NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_fee_assessed_at         timestamptz;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proofs_due_at                timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reconciled_at                timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trip_pot_released_at         timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at                 timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rating_link_sent_at          timestamptz;

-- ─────────────────────────────────────────────────────────────────
-- users — buddy payout target + ban tracking
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_vpa                text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_fund_account_id  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned                 boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at                 timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason             text;

-- ─────────────────────────────────────────────────────────────────
-- payment_events — late-fee component flag + idempotency key
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE payment_events ADD COLUMN IF NOT EXISTS is_late_fee_component  boolean NOT NULL DEFAULT false;
ALTER TABLE payment_events ADD COLUMN IF NOT EXISTS idempotency_key        text;

-- Unique on idempotency_key (when present). Razorpay reuses the key on retries
-- to prevent double-charges; we mirror that uniqueness DB-side.
DO $$ BEGIN
  CREATE UNIQUE INDEX uniq_payment_events_idempotency_key
    ON payment_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- Enum extensions
-- ─────────────────────────────────────────────────────────────────
ALTER TYPE payment_kind ADD VALUE IF NOT EXISTS 'platform_credit';
ALTER TYPE payout_kind  ADD VALUE IF NOT EXISTS 'late_fee_forfeit_to_platform';
ALTER TYPE payout_kind  ADD VALUE IF NOT EXISTS 'platform_credit';

-- ─────────────────────────────────────────────────────────────────
-- Partial indexes for cron-job scans
-- All filter on `status` and the relevant time column, sized for the
-- expected hot rows only (pre-trip + reconciling rows).
-- ─────────────────────────────────────────────────────────────────

-- cron_late_fee_assess: scan for awaiting_balance bookings where T-72h is due.
-- Joins agreements for trip_starts_at (the agreement is the source of truth
-- for trip timing post-Phase 2; bookings.tour_start_time is a legacy field).
CREATE INDEX IF NOT EXISTS idx_bookings_late_fee_assess
  ON bookings (status, late_fee_assessed_at)
  WHERE status = 'awaiting_balance' AND late_fee_assessed_at IS NULL;

-- cron_no_pay_cancel: scan late_fee_due for T-12h cutoff.
CREATE INDEX IF NOT EXISTS idx_bookings_no_pay_cancel
  ON bookings (status)
  WHERE status = 'late_fee_due';

-- cron_t_minus_12_balance_paid: scan balance_paid for T-12h promotion to trip_ready.
CREATE INDEX IF NOT EXISTS idx_bookings_t_minus_12
  ON bookings (status)
  WHERE status = 'balance_paid';

-- cron_proofs_overdue: scan awaiting_proofs past their proofs_due_at.
CREATE INDEX IF NOT EXISTS idx_bookings_proofs_overdue
  ON bookings (status, proofs_due_at)
  WHERE status = 'awaiting_proofs';

-- cron_rating_link_send: scan completed bookings without a rating link sent.
CREATE INDEX IF NOT EXISTS idx_bookings_rating_pending
  ON bookings (status, completed_at)
  WHERE status = 'completed' AND rating_link_sent_at IS NULL;

-- cron_deposit_window_expire: scan awaiting_deposits older than 24h.
CREATE INDEX IF NOT EXISTS idx_bookings_deposit_expire
  ON bookings (status, created_at)
  WHERE status = 'awaiting_deposits';
