-- ============================================================================
-- NOTIFICATIONS — push delivery tracking columns
-- ============================================================================
-- Phase 3+4 cron jobs already write rows to `notifications`.  Phase 5 needs to
-- track which rows have been pushed to the device, which failed, and where
-- the user should be deep-linked when they tap the push.
-- ============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS push_sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS push_failed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS push_failed_reason  text,
  ADD COLUMN IF NOT EXISTS deep_link           text;
  -- e.g., '/trips/balance/<bookingId>', '/trips/live/<bookingId>'.  Optional —
  -- the Edge fn falls back to deepLinkFor(kind, booking_id) when null.

-- Partial index for the cron polling query.  Keeps the scan O(pending) even
-- when the notifications table grows large.
CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON notifications(sent_at)
  WHERE push_sent_at IS NULL
    AND push_failed_at IS NULL
    AND recipient_user_id IS NOT NULL;
