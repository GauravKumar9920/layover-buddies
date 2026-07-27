-- ============================================================================
-- STRUCTURED GUIDE PROFILE PHOTOS
-- ============================================================================
-- A profile photo must have one declared job. The old gallery_urls array was
-- consumed by the cover, quote, prompts, timeline, and journal, so adding one
-- image could move it into several unrelated surfaces. This table separates:
--   cover   — the single public-profile lead image
--   story   — the optional image behind the guide's interview quote
--   gallery — an ordered, captioned photo-journal item
--
-- Tour covers, tour galleries, and stop images remain on itineraries.
-- ============================================================================

ALTER TABLE public.guide_profiles
  ADD COLUMN IF NOT EXISTS profile_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

ALTER TABLE public.guide_profiles
  DROP CONSTRAINT IF EXISTS guide_profiles_profile_status_check;
ALTER TABLE public.guide_profiles
  ADD CONSTRAINT guide_profiles_profile_status_check
  CHECK (profile_status IN ('draft', 'published'));

-- Existing active profiles were already browseable before this migration.
UPDATE public.guide_profiles
SET profile_status = 'published',
    profile_completed_at = COALESCE(profile_completed_at, updated_at, created_at, now())
WHERE is_active = true
  AND profile_status = 'draft';

ALTER TABLE public.guide_profiles
  ALTER COLUMN is_active SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.keep_new_guide_profiles_in_draft()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.profile_status = 'draft' THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_new_guide_profiles_in_draft
  ON public.guide_profiles;
CREATE TRIGGER keep_new_guide_profiles_in_draft
  BEFORE INSERT ON public.guide_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_new_guide_profiles_in_draft();

ALTER TABLE public.guide_profiles
  DROP CONSTRAINT IF EXISTS guide_profiles_active_requires_published;
ALTER TABLE public.guide_profiles
  ADD CONSTRAINT guide_profiles_active_requires_published
  CHECK (is_active = false OR profile_status = 'published');

-- "Published" used to be a misleading policy name with USING (true). Draft
-- profiles are now private to their owner; accepting bookings remains a
-- separate is_active decision.
DROP POLICY IF EXISTS "Everyone can read published guide profiles"
  ON public.guide_profiles;
CREATE POLICY "Everyone can read published guide profiles"
  ON public.guide_profiles
  FOR SELECT
  TO anon, authenticated
  USING (profile_status = 'published');

CREATE TABLE IF NOT EXISTS public.guide_profile_photos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_profile_id uuid NOT NULL
    REFERENCES public.guide_profiles(id) ON DELETE CASCADE,
  role             text NOT NULL
    CHECK (role IN ('cover', 'story', 'gallery')),
  storage_bucket   text,
  storage_path     text,
  url              text NOT NULL
    CHECK (length(trim(url)) > 0),
  caption          text
    CHECK (caption IS NULL OR char_length(caption) <= 180),
  position         smallint NOT NULL DEFAULT 0
    CHECK (position >= 0 AND position <= 99),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guide_profile_photos_one_cover
  ON public.guide_profile_photos(guide_profile_id)
  WHERE role = 'cover';

CREATE UNIQUE INDEX IF NOT EXISTS guide_profile_photos_one_story
  ON public.guide_profile_photos(guide_profile_id)
  WHERE role = 'story';

CREATE INDEX IF NOT EXISTS guide_profile_photos_order
  ON public.guide_profile_photos(guide_profile_id, role, position, created_at);

DROP TRIGGER IF EXISTS update_guide_profile_photos_updated_at
  ON public.guide_profile_photos;
CREATE TRIGGER update_guide_profile_photos_updated_at
  BEFORE UPDATE ON public.guide_profile_photos
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.guide_profile_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active guide profile photos"
  ON public.guide_profile_photos;
CREATE POLICY "Public can read active guide profile photos"
  ON public.guide_profile_photos
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.guide_profiles gp
      WHERE gp.id = guide_profile_photos.guide_profile_id
        AND (
          (gp.is_active = true AND gp.profile_status = 'published')
          OR gp.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Guides can add own profile photos"
  ON public.guide_profile_photos;
CREATE POLICY "Guides can add own profile photos"
  ON public.guide_profile_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.account_is_active(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.guide_profiles gp
      WHERE gp.id = guide_profile_photos.guide_profile_id
        AND gp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Guides can update own profile photos"
  ON public.guide_profile_photos;
CREATE POLICY "Guides can update own profile photos"
  ON public.guide_profile_photos
  FOR UPDATE
  TO authenticated
  USING (
    public.account_is_active(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.guide_profiles gp
      WHERE gp.id = guide_profile_photos.guide_profile_id
        AND gp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.account_is_active(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.guide_profiles gp
      WHERE gp.id = guide_profile_photos.guide_profile_id
        AND gp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Guides can delete own profile photos"
  ON public.guide_profile_photos;
CREATE POLICY "Guides can delete own profile photos"
  ON public.guide_profile_photos
  FOR DELETE
  TO authenticated
  USING (
    public.account_is_active(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.guide_profiles gp
      WHERE gp.id = guide_profile_photos.guide_profile_id
        AND gp.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.guide_profile_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_profile_photos TO authenticated;

COMMENT ON TABLE public.guide_profile_photos IS
  'Explicitly placed guide profile media. Never use these rows as itinerary or stop photos.';
COMMENT ON COLUMN public.guide_profile_photos.role IS
  'cover is the lead image, story supports the interview quote, gallery appears only in the ordered photo journal.';
COMMENT ON COLUMN public.guide_profile_photos.caption IS
  'Short context written by the guide; primarily displayed under photo-journal images.';
COMMENT ON COLUMN public.guide_profile_photos.storage_path IS
  'Owner-namespaced Supabase Storage object path. Nullable for legacy/external URLs.';

-- Preserve existing guide uploads, but give each URL a stable, non-random job.
-- We cannot know whether an old upload was intended as a cover or story image,
-- so every legacy item remains an ordered journal photo. The guide can assign
-- cover and story intentionally in the new builder. The old array remains for
-- rollback compatibility and can be removed after deployed clients migrate.
WITH legacy AS (
  SELECT
    gp.id AS guide_profile_id,
    item.url,
    item.ordinality
  FROM public.guide_profiles gp
  CROSS JOIN LATERAL unnest(COALESCE(gp.gallery_urls, ARRAY[]::text[]))
    WITH ORDINALITY AS item(url, ordinality)
  WHERE length(trim(item.url)) > 0
)
INSERT INTO public.guide_profile_photos (
  guide_profile_id,
  role,
  url,
  position
)
SELECT
  guide_profile_id,
  'gallery',
  url,
  (ordinality - 1)::smallint
FROM legacy
ON CONFLICT DO NOTHING;
