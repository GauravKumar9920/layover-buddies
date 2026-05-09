-- ============================================================================
-- FIX: payout_dispatches ON CONFLICT constraint
-- ============================================================================
-- Migration 100200 (reconciliation) and 100300 (cancellation) both use:
--
--   ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING
--
-- PostgreSQL requires ON CONFLICT to reference either a unique constraint or a
-- partial unique index WITH the matching WHERE predicate.  The existing partial
-- index (uniq_payout_dispatch_reconcile) only covers three reconciliation kinds;
-- cancellation kinds (traveler_deposit_refund, buddy_deposit_refund, …) are not
-- covered at all.  Without the full constraint the function bodies throw:
--
--   "there is no unique or exclusion constraint matching the ON CONFLICT spec"
--
-- Fix: replace the partial index with a full unique constraint on
-- (booking_id, kind, recipient_user_id).
--
-- Safety: a booking can only be cancelled/reconciled once, so each
-- (booking_id, kind, recipient) triple is naturally unique in practice.
-- ============================================================================

-- ── payout_dispatches ────────────────────────────────────────────────────────

-- Drop the partial index that is now superseded.
DROP INDEX IF EXISTS uniq_payout_dispatch_reconcile;

-- Full unique constraint — satisfies all ON CONFLICT clauses in
-- compute_reconciliation_tx and compute_cancellation_resolution_tx.
-- NULLs are distinct in PostgreSQL unique constraints so there is no
-- regression: no payout_dispatches rows have NULL in these columns.
ALTER TABLE payout_dispatches
  ADD CONSTRAINT uniq_payout_dispatch_booking_kind_recipient
  UNIQUE (booking_id, kind, recipient_user_id);

-- ── notifications ─────────────────────────────────────────────────────────────

-- Drop the partial index (WHERE booking_id IS NOT NULL).  The ON CONFLICT
-- clauses in cron functions don't specify the WHERE predicate so they can't
-- resolve against a partial index.  A full unique constraint works instead:
-- rows with booking_id IS NULL remain unrestricted because NULL != NULL in
-- PostgreSQL unique evaluation, so system-level notifications are unaffected.
DROP INDEX IF EXISTS uniq_notifications_booking_kind;

ALTER TABLE notifications
  ADD CONSTRAINT uniq_notifications_booking_kind_recipient
  UNIQUE (booking_id, kind, recipient_user_id);
