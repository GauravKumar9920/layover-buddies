-- ============================================================================
-- TRAVELER TRIP SHAPE — age band, party type, 4-person party cap
-- ============================================================================
-- Two new facts about a traveler, deliberately stored in different places:
--
--   age_band   → traveler_profiles.  Identity. A returning traveler does not
--                re-answer how old they are, and it survives archiving a trip.
--   party_type → traveler_layovers.  Per-trip, so it sits beside group_size.
--                The same person is solo in March and a family in December.
--
-- Bands rather than a date of birth: enough for a Buddy to pitch the day, not
-- enough to identify anyone, and it never goes stale the way a stored integer
-- age would.
--
-- Both columns are NULLable so every existing row and all of seed.sql stay
-- valid. The app treats NULL as "not answered yet".
-- ============================================================================

-- ── Age band (identity) ─────────────────────────────────────────────────────

ALTER TABLE public.traveler_profiles
  ADD COLUMN IF NOT EXISTS age_band text;

ALTER TABLE public.traveler_profiles
  DROP CONSTRAINT IF EXISTS traveler_profiles_age_band_check;
ALTER TABLE public.traveler_profiles
  ADD CONSTRAINT traveler_profiles_age_band_check
  CHECK (
    age_band IS NULL
    OR age_band IN ('18_24', '25_34', '35_49', '50_64', '65_plus')
  );

COMMENT ON COLUMN public.traveler_profiles.age_band IS
  'Coarse age bracket collected at onboarding. Bands, never a date of birth — enough for a Buddy to plan the day, not enough to identify anyone.';

-- ── Party type (per-trip) ───────────────────────────────────────────────────

ALTER TABLE public.traveler_layovers
  ADD COLUMN IF NOT EXISTS party_type text;

ALTER TABLE public.traveler_layovers
  DROP CONSTRAINT IF EXISTS traveler_layovers_party_type_check;
ALTER TABLE public.traveler_layovers
  ADD CONSTRAINT traveler_layovers_party_type_check
  CHECK (
    party_type IS NULL
    OR party_type IN ('solo', 'couple', 'family', 'friends')
  );

COMMENT ON COLUMN public.traveler_layovers.party_type IS
  'Who is travelling on THIS trip. Per-trip, so it lives beside group_size on the layover rather than on the traveler profile.';

-- ── Widen the party cap 3 → 4 ───────────────────────────────────────────────
-- The original CHECK was written inline on the column in the CREATE TABLE
-- (20260726106000), so its generated name is an assumption. Drop by catalog
-- lookup instead of by guessed name: a DROP ... IF EXISTS that misses leaves
-- the old 1..3 CHECK in force alongside the new one, and travelers silently
-- still cannot pick 4 — with no error anywhere to explain why.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.traveler_layovers'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%group_size%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.traveler_layovers DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.traveler_layovers
  ADD CONSTRAINT traveler_layovers_group_size_check
  CHECK (group_size BETWEEN 1 AND 4);

COMMENT ON COLUMN public.traveler_layovers.group_size IS
  'How many people are travelling on this layover, 1-4. The single source of truth for party size; bookings.num_travelers snapshots it at inquiry time.';

NOTIFY pgrst, 'reload schema';
