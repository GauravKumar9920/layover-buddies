-- ============================================================================
-- ITINERARY COLUMNS (2026-04-29)
-- max_travelers: group-size cap for booking. UI already collected this value;
--                schema simply didn't persist it.
-- deleted_at:    soft-delete marker so "Delete Tour" stays gone (was previously
--                conflated with is_published, which is the pause/activate flag).
-- ============================================================================

ALTER TABLE itineraries
  ADD COLUMN IF NOT EXISTS max_travelers INT NOT NULL DEFAULT 1
    CHECK (max_travelers >= 1 AND max_travelers <= 12),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Active rows are the common-case query target; partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_itineraries_deleted_at
  ON itineraries(deleted_at) WHERE deleted_at IS NULL;
