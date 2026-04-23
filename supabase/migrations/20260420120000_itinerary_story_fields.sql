-- Extend itineraries table with story-content fields for the new
-- package detail screen (mobile/app/(traveler)/itinerary/[id].tsx).
--
-- - story_blocks: ordered rich-text blocks (paragraph / quote / highlight)
--   rendered in the narrative section below the hero parallax.
-- - gallery_urls: horizontal snap-scroll gallery images for the package.
-- - video_url / video_duration_seconds: optional reel thumbnail + duration
--   label shown above the sticky "Book this package" CTA.
--
-- Legacy rows keep NULL/empty defaults; the screen falls back to
-- buildMockStory() until real content is populated.

alter table itineraries
  add column if not exists story_blocks jsonb default '[]',
  add column if not exists gallery_urls text[] default '{}',
  add column if not exists video_url text,
  add column if not exists video_duration_seconds int;
