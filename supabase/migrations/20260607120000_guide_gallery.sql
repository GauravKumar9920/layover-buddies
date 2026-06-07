-- ============================================================================
-- Guide profile photo gallery
-- ============================================================================
-- Powers the photo-forward guide profile (swipeable hero gallery + masonry
-- "photo journal"). Guides upload their own walk photos from Guide → Profile.
-- When empty, the app falls back to curated Mumbai scenes (config/photoLibrary),
-- so profiles never look bare. Mirrors the existing itineraries.gallery_urls.
-- ============================================================================

ALTER TABLE guide_profiles
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT '{}';
