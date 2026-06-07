-- ============================================================================
-- Traveler gender (collected during onboarding)
-- ============================================================================
-- Stored as a short text key: 'female' | 'male' | 'non_binary' |
-- 'prefer_not_to_say'. Optional — older rows stay NULL. Used to help guides
-- tailor the experience and for safety context on active trips.
-- ============================================================================

ALTER TABLE traveler_profiles
  ADD COLUMN IF NOT EXISTS gender TEXT;
