-- ============================================================================
-- TRAVELER ONBOARDING FIELDS (2026-05-16)
-- ============================================================================
-- Captures three things the booking flow has been missing:
--
--   1. Nationality — picked from a flag-picker during signup. Was already a
--      column on traveler_profiles but never wired to a UI.
--
--   2. Layover window — `arrival_at` + `departure_at`. The booking form has
--      always asked for these per-booking; capturing them once at signup
--      lets Explore/Itinerary screens compute red/yellow/green time-fit
--      badges *before* the traveler chooses a guide.
--
--   3. Interests — a string[] of vibe keywords ("food", "history", etc).
--      Used as a soft ranking signal: guides whose `skills` overlap with a
--      traveler's `interests` bubble up, but no one is hard-filtered out.
--
-- All columns are nullable so old rows keep working; the app guards every
-- read with sensible fallbacks.
-- ============================================================================

ALTER TABLE public.traveler_profiles
  ADD COLUMN IF NOT EXISTS arrival_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS departure_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flight_in    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS flight_out   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS interests    TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.traveler_profiles.arrival_at IS
  'When the traveler lands in Mumbai. Captured at onboarding; used by Explore to compute time-fit badges per itinerary.';
COMMENT ON COLUMN public.traveler_profiles.departure_at IS
  'When the traveler flies out. Together with arrival_at defines the layover window.';
COMMENT ON COLUMN public.traveler_profiles.interests IS
  'Soft signal for ranking guides. Overlap with guide.skills[].name boosts a guide''s position on Explore.';
COMMENT ON COLUMN public.traveler_profiles.onboarded_at IS
  'Set when the traveler completes the post-signup onboarding flow. Used by the root layout to gate access to Explore.';

-- ── RLS: travelers must be able to UPDATE their own profile row ─────────────
-- The initial schema only created SELECT/INSERT policies. Without UPDATE,
-- the onboarding screen would fail silently to persist nationality/dates.

DROP POLICY IF EXISTS "Travelers can update own profile" ON public.traveler_profiles;
CREATE POLICY "Travelers can update own profile" ON public.traveler_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
