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

-- NOTE — state inconsistency trade-off (acknowledged):
-- These mappings advance bookings to states that imply related records exist
-- (e.g. balance_paid implies a payment_events row; awaiting_deposits implies
-- both parties signed an agreement). For pre-Phase-1 rows those ancillary
-- records do not exist. This is an accepted operational inconsistency: the
-- financial tables are additive (new bookings will have them), and any legacy
-- rows that surface in the UI will display neutrally via the mobile fallback
-- rather than crashing. Ops can retroactively backfill or reclassify rows
-- as needed. Phase 2+ will not create bookings without the full record set.

UPDATE bookings SET status = 'agreement_sent'        WHERE status = 'pending';
UPDATE bookings SET status = 'awaiting_deposits'     WHERE status = 'guide_accepted';
UPDATE bookings SET status = 'balance_paid'          WHERE status = 'confirmed';

-- declined doesn't exist in the enum so this WHERE clause matches nothing —
-- but kept here as documentation for the latent-bug fix and as a safety net
-- in case a future migration ever adds it.
UPDATE bookings SET status = 'cancelled_pre_signing' WHERE status::text = 'declined';
