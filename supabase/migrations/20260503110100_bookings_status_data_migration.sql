-- ============================================================================
-- BOOKINGS STATUS DATA MIGRATION (Phase 1, Migration 2.5 of 3)
-- ============================================================================
-- Runs in a separate transaction from the enum-extension migration so the
-- newly-added enum values (added in 20260503110000_bookings_status_extension.sql)
-- can be referenced in UPDATE statements.
--
-- Mappings (per §5 Migration 2 of the financial-model handoff, plus the
-- declined → cancelled_pre_signing fix for the latent mobile-constants bug):
--   pending         → agreement_sent      (booking exists but agreement not yet drafted)
--   guide_accepted  → awaiting_deposits   (guide said yes, deposits not yet posted)
--   confirmed       → balance_paid        (full balance was captured)
--   declined        → cancelled_pre_signing  (mobile constant referenced this value
--                                            despite it not existing in the DB enum;
--                                            no-op if no rows have it, but still safe)
--   in_progress     → unchanged
--   completed       → unchanged
--   cancelled       → unchanged           (will be re-classified by ops as needed)
--   disputed        → unchanged
-- ============================================================================

UPDATE bookings SET status = 'agreement_sent'        WHERE status = 'pending';
UPDATE bookings SET status = 'awaiting_deposits'     WHERE status = 'guide_accepted';
UPDATE bookings SET status = 'balance_paid'          WHERE status = 'confirmed';

-- declined doesn't exist in the enum so this WHERE clause matches nothing —
-- but kept here as documentation for the latent-bug fix and as a safety net
-- in case a future migration ever adds it.
UPDATE bookings SET status = 'cancelled_pre_signing' WHERE status::text = 'declined';
