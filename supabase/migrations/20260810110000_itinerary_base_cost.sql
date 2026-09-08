-- ============================================================================
-- ITINERARY PRICING: base charge + per-person charge
-- ============================================================================
-- buddy_cost keeps its existing meaning as the PER-PERSON component.
-- base_cost is a flat charge applied once per booking. A party of N pays:
--
--     base_cost + buddy_cost * N
--
-- Existing rows get base_cost = 0 from the DEFAULT, so the formula collapses
-- to buddy_cost * N — exactly today's behaviour. Nothing to backfill, and no
-- visual change on any existing tour.
--
-- ADD COLUMN ... NOT NULL DEFAULT 0 with a non-volatile default does not
-- rewrite the table on PG11+; it takes a brief ACCESS EXCLUSIVE lock only.
-- ============================================================================

ALTER TABLE public.itineraries
  ADD COLUMN IF NOT EXISTS base_cost DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.itineraries.base_cost IS
  'Flat charge applied once per booking, regardless of party size. Covers the Buddy''s fixed effort — planning the day, showing up — which does not scale with headcount.';
COMMENT ON COLUMN public.itineraries.buddy_cost IS
  'Per-person component. A party of N pays base_cost + buddy_cost * N.';

-- ── Relax the positivity rule ───────────────────────────────────────────────
-- 20260412110000_initial_schema.sql:244 declares
--     CONSTRAINT cost_valid CHECK (buddy_cost > 0)
-- which makes a base-only price — a flat fee with ₹0 per head — impossible to
-- save. Replace it with per-column non-negativity plus a combined positivity
-- rule, so exactly one of the two components may be zero but not both.
--
-- Note `cost_valid` is also the constraint name on itinerary_stops and on
-- bookings. Constraint names are scoped per-table, so this DROP touches only
-- itineraries.

ALTER TABLE public.itineraries DROP CONSTRAINT IF EXISTS cost_valid;

ALTER TABLE public.itineraries
  ADD CONSTRAINT itineraries_base_cost_non_negative  CHECK (base_cost  >= 0);
ALTER TABLE public.itineraries
  ADD CONSTRAINT itineraries_buddy_cost_non_negative CHECK (buddy_cost >= 0);
ALTER TABLE public.itineraries
  ADD CONSTRAINT itineraries_price_positive          CHECK (base_cost + buddy_cost > 0);

-- Every pre-existing row satisfies all three: the old CHECK guaranteed
-- buddy_cost > 0, and the DEFAULT supplies base_cost = 0.

NOTIFY pgrst, 'reload schema';
