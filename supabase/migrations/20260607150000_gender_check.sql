-- ============================================================================
-- Constrain traveler_profiles.gender to the app's taxonomy
-- ============================================================================
-- Keeps the column tidy and aligned with the onboarding options. NULL stays
-- allowed (gender is optional / "prefer not to say" is an explicit value).
-- ============================================================================

ALTER TABLE traveler_profiles DROP CONSTRAINT IF EXISTS gender_check;
ALTER TABLE traveler_profiles
  ADD CONSTRAINT gender_check
  CHECK (gender IS NULL OR gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say'));
