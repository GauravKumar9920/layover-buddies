-- ============================================================================
-- STRUCTURED PROFILE SECURITY + LIFECYCLE HARDENING
-- ============================================================================
-- Make the profile-builder contracts authoritative in Postgres:
--   * only real guide accounts can own guide profiles;
--   * direct clients cannot bypass publication validation;
--   * published guides cannot remove required trust fields;
--   * paused published profiles keep their explicitly placed media;
--   * retired broad traveler columns cannot become a safety-data backdoor.
-- ============================================================================

-- The legacy columns were migrated in 20260726106000. Keep them physically
-- present for one compatibility release, but make it impossible for an old or
-- hostile client to repopulate them under the broader traveler-profile RLS.
ALTER TABLE public.traveler_profiles
  DROP CONSTRAINT IF EXISTS traveler_profiles_retired_trip_fields_empty,
  DROP CONSTRAINT IF EXISTS traveler_profiles_retired_safety_fields_empty;

ALTER TABLE public.traveler_profiles
  ADD CONSTRAINT traveler_profiles_retired_trip_fields_empty
    CHECK (
      arrival_at IS NULL
      AND departure_at IS NULL
      AND flight_in IS NULL
      AND flight_out IS NULL
    ),
  ADD CONSTRAINT traveler_profiles_retired_safety_fields_empty
    CHECK (
      gender IS NULL
      AND emergency_contact_name IS NULL
      AND emergency_contact_phone IS NULL
    );

ALTER TABLE public.traveler_layovers
  DROP CONSTRAINT IF EXISTS traveler_layovers_minimum_window;
ALTER TABLE public.traveler_layovers
  ADD CONSTRAINT traveler_layovers_minimum_window
  CHECK (departure_at - arrival_at >= interval '7 hours');

-- Profile rows must agree with users.role even when a SECURITY DEFINER RPC is
-- called by the wrong account type.
CREATE OR REPLACE FUNCTION public.enforce_traveler_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
     FROM public.users u
     WHERE u.id = NEW.user_id
       AND u.role = 'traveler'
  ) THEN
    RAISE EXCEPTION 'traveler_role_required';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_traveler_profile_role() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_traveler_profile_role
  ON public.traveler_profiles;
CREATE TRIGGER enforce_traveler_profile_role
  BEFORE INSERT OR UPDATE ON public.traveler_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_traveler_profile_role();

CREATE OR REPLACE FUNCTION public.enforce_structured_traveler_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
     FROM public.users u
     WHERE u.id = NEW.traveler_id
       AND u.role = 'traveler'
  ) THEN
    RAISE EXCEPTION 'traveler_role_required';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_structured_traveler_role() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_traveler_layover_role
  ON public.traveler_layovers;
CREATE TRIGGER enforce_traveler_layover_role
  BEFORE INSERT OR UPDATE ON public.traveler_layovers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_structured_traveler_role();

DROP TRIGGER IF EXISTS enforce_traveler_safety_role
  ON public.traveler_safety_profiles;
CREATE TRIGGER enforce_traveler_safety_role
  BEFORE INSERT OR UPDATE ON public.traveler_safety_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_structured_traveler_role();

DROP POLICY IF EXISTS "Users can create own traveler profile"
  ON public.traveler_profiles;
CREATE POLICY "Travelers can create own traveler profile"
  ON public.traveler_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.account_is_active(auth.uid())
    AND EXISTS (
      SELECT 1
        FROM public.users u
       WHERE u.id = auth.uid()
         AND u.role = 'traveler'
    )
  );

DROP POLICY IF EXISTS "Users can update own traveler profile"
  ON public.traveler_profiles;
DROP POLICY IF EXISTS "Travelers can update own profile"
  ON public.traveler_profiles;
CREATE POLICY "Travelers can update own traveler profile"
  ON public.traveler_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.account_is_active(auth.uid())
    AND EXISTS (
      SELECT 1
        FROM public.users u
       WHERE u.id = auth.uid()
         AND u.role = 'traveler'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.account_is_active(auth.uid())
    AND EXISTS (
      SELECT 1
        FROM public.users u
       WHERE u.id = auth.uid()
         AND u.role = 'traveler'
    )
  );

CREATE OR REPLACE FUNCTION public.create_my_next_layover(
  p_arrival_at timestamptz,
  p_departure_at timestamptz,
  p_flight_in text DEFAULT NULL,
  p_flight_out text DEFAULT NULL,
  p_group_size smallint DEFAULT 1,
  p_airport_code text DEFAULT 'BOM'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_layover_id uuid;
BEGIN
  IF v_user_id IS NULL OR NOT public.account_is_active(v_user_id) THEN
    RAISE EXCEPTION 'not_authenticated_or_inactive';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = v_user_id
       AND u.role = 'traveler'
  ) THEN
    RAISE EXCEPTION 'traveler_role_required';
  END IF;
  IF p_departure_at - p_arrival_at < interval '7 hours' THEN
    RAISE EXCEPTION 'layover_must_be_at_least_seven_hours';
  END IF;
  IF p_group_size NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid_group_size';
  END IF;
  IF char_length(trim(p_airport_code)) <> 3 THEN
    RAISE EXCEPTION 'invalid_airport_code';
  END IF;

  UPDATE public.traveler_layovers
     SET status = 'archived'
   WHERE traveler_id = v_user_id
     AND status = 'active';

  INSERT INTO public.traveler_layovers (
    traveler_id,
    airport_code,
    arrival_at,
    departure_at,
    flight_in,
    flight_out,
    group_size,
    status
  )
  VALUES (
    v_user_id,
    upper(trim(p_airport_code)),
    p_arrival_at,
    p_departure_at,
    NULLIF(trim(p_flight_in), ''),
    NULLIF(trim(p_flight_out), ''),
    p_group_size,
    'active'
  )
  RETURNING id INTO v_layover_id;

  RETURN v_layover_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_next_layover(
  timestamptz, timestamptz, text, text, smallint, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_my_next_layover(
  timestamptz, timestamptz, text, text, smallint, text
) TO authenticated;

-- New guide profiles always start private and unavailable, regardless of what
-- an inserting client sends. Also reject traveler-owned guide rows.
CREATE OR REPLACE FUNCTION public.keep_new_guide_profiles_in_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = NEW.user_id
       AND u.role = 'guide'
       AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'guide_role_required';
  END IF;

  NEW.profile_status := 'draft';
  NEW.profile_completed_at := NULL;
  NEW.is_active := false;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_new_guide_profiles_in_draft() FROM PUBLIC;

DROP POLICY IF EXISTS "Users can create own guide profile"
  ON public.guide_profiles;
CREATE POLICY "Guides can create own guide profile"
  ON public.guide_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.account_is_active(auth.uid())
    AND EXISTS (
      SELECT 1
        FROM public.users u
       WHERE u.id = auth.uid()
         AND u.role = 'guide'
    )
  );

-- Central validator used by publishing and by every edit that could invalidate
-- an already-published profile.
CREATE OR REPLACE FUNCTION public.guide_profile_missing_fields(
  p_profile_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.guide_profiles%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_missing text[] := ARRAY[]::text[];
  v_languages jsonb;
  v_prompts jsonb;
BEGIN
  SELECT *
    INTO v_profile
    FROM public.guide_profiles
   WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN ARRAY['guide profile'];
  END IF;

  SELECT *
    INTO v_user
    FROM public.users
   WHERE id = v_profile.user_id;

  IF v_user.role <> 'guide' OR v_user.deleted_at IS NOT NULL THEN
    v_missing := array_append(v_missing, 'guide account');
  END IF;
  IF NULLIF(trim(v_user.full_name), '') IS NULL THEN
    v_missing := array_append(v_missing, 'full name');
  END IF;
  IF NULLIF(trim(v_user.avatar_url), '') IS NULL THEN
    v_missing := array_append(v_missing, 'face photo');
  END IF;
  IF NULLIF(trim(v_profile.university), '') IS NULL THEN
    v_missing := array_append(v_missing, 'university');
  END IF;
  IF NULLIF(trim(v_profile.bio), '') IS NULL THEN
    v_missing := array_append(v_missing, 'bio');
  END IF;

  v_languages := CASE
    WHEN jsonb_typeof(v_profile.languages) = 'array'
      THEN v_profile.languages
    ELSE '[]'::jsonb
  END;
  IF NOT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_languages) AS item(value)
     WHERE CASE jsonb_typeof(item.value)
       WHEN 'string' THEN NULLIF(trim(item.value #>> '{}'), '') IS NOT NULL
       WHEN 'object' THEN NULLIF(
         trim(COALESCE(item.value->>'language', item.value->>'name', '')),
         ''
       ) IS NOT NULL
       ELSE false
     END
  ) THEN
    v_missing := array_append(v_missing, 'language');
  END IF;

  v_prompts := CASE
    WHEN jsonb_typeof(v_profile.prompts) = 'array'
      THEN v_profile.prompts
    ELSE '[]'::jsonb
  END;
  IF NOT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_prompts) AS item(value)
     WHERE jsonb_typeof(item.value) = 'object'
       AND NULLIF(trim(item.value->>'question'), '') IS NOT NULL
       AND NULLIF(trim(item.value->>'answer'), '') IS NOT NULL
  ) THEN
    v_missing := array_append(v_missing, 'story answer');
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.guide_profile_photos photos
     WHERE photos.guide_profile_id = v_profile.id
       AND photos.role = 'cover'
       AND NULLIF(trim(photos.url), '') IS NOT NULL
  ) THEN
    v_missing := array_append(v_missing, 'profile cover');
  END IF;

  RETURN v_missing;
END;
$$;

REVOKE ALL ON FUNCTION public.guide_profile_missing_fields(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.publish_my_guide_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_missing text[];
BEGIN
  IF v_user_id IS NULL OR NOT public.account_is_active(v_user_id) THEN
    RAISE EXCEPTION 'not_authenticated_or_inactive';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = v_user_id
       AND u.role = 'guide'
  ) THEN
    RAISE EXCEPTION 'guide_role_required';
  END IF;

  SELECT id
    INTO v_profile_id
    FROM public.guide_profiles
   WHERE user_id = v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guide_profile_not_found';
  END IF;

  v_missing := public.guide_profile_missing_fields(v_profile_id);
  IF cardinality(v_missing) > 0 THEN
    RETURN jsonb_build_object(
      'published', false,
      'missing', to_jsonb(v_missing)
    );
  END IF;

  UPDATE public.guide_profiles
     SET profile_status = 'published',
         profile_completed_at = COALESCE(profile_completed_at, now())
   WHERE id = v_profile_id;

  RETURN jsonb_build_object(
    'published', true,
    'missing', '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_my_guide_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_my_guide_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.move_my_guide_profile_to_draft()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR NOT public.account_is_active(v_user_id) THEN
    RAISE EXCEPTION 'not_authenticated_or_inactive';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = v_user_id
       AND u.role = 'guide'
  ) THEN
    RAISE EXCEPTION 'guide_role_required';
  END IF;

  UPDATE public.guide_profiles
     SET profile_status = 'draft',
         is_active = false
   WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guide_profile_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.move_my_guide_profile_to_draft() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_my_guide_profile_to_draft()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_guide_availability(
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_missing text[];
BEGIN
  IF v_user_id IS NULL OR NOT public.account_is_active(v_user_id) THEN
    RAISE EXCEPTION 'not_authenticated_or_inactive';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = v_user_id
       AND u.role = 'guide'
  ) THEN
    RAISE EXCEPTION 'guide_role_required';
  END IF;

  SELECT id
    INTO v_profile_id
    FROM public.guide_profiles
   WHERE user_id = v_user_id
     AND (p_is_active = false OR profile_status = 'published')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'published_guide_profile_required';
  END IF;

  IF p_is_active THEN
    v_missing := public.guide_profile_missing_fields(v_profile_id);
    IF cardinality(v_missing) > 0 THEN
      RAISE EXCEPTION 'complete_profile_before_accepting_inquiries:%',
        array_to_string(v_missing, ',');
    END IF;
  END IF;

  UPDATE public.guide_profiles
     SET is_active = p_is_active
   WHERE id = v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_guide_availability(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_guide_availability(boolean)
  TO authenticated;

-- Guide content is saved atomically. If a published profile edit removes a
-- required trust field, automatically return it to draft and pause inquiries.
-- This also lets grandfathered incomplete profiles enter the new builder
-- without trapping their owner behind a validation error.
DROP FUNCTION IF EXISTS public.save_my_guide_profile_tx(
  text, text, jsonb, text, text, text, jsonb
);

CREATE FUNCTION public.save_my_guide_profile_tx(
  p_full_name text,
  p_bio text,
  p_languages jsonb,
  p_university text,
  p_hometown text,
  p_pull_quote text,
  p_prompts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_profile_status text;
  v_missing text[];
BEGIN
  IF v_user_id IS NULL OR NOT public.account_is_active(v_user_id) THEN
    RAISE EXCEPTION 'not_authenticated_or_inactive';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = v_user_id
       AND u.role = 'guide'
  ) THEN
    RAISE EXCEPTION 'guide_role_required';
  END IF;
  IF NULLIF(trim(p_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'full_name_required';
  END IF;
  IF jsonb_typeof(COALESCE(p_languages, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'languages_must_be_an_array';
  END IF;
  IF jsonb_typeof(COALESCE(p_prompts, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'prompts_must_be_an_array';
  END IF;

  SELECT id, profile_status
    INTO v_profile_id, v_profile_status
    FROM public.guide_profiles
   WHERE user_id = v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guide_profile_not_found';
  END IF;

  UPDATE public.users
     SET full_name = trim(p_full_name)
   WHERE id = v_user_id;

  UPDATE public.guide_profiles
     SET bio = NULLIF(trim(p_bio), ''),
         languages = COALESCE(p_languages, '[]'::jsonb),
         university = NULLIF(trim(p_university), ''),
         hometown = NULLIF(trim(p_hometown), ''),
         pull_quote = NULLIF(trim(p_pull_quote), ''),
         prompts = COALESCE(p_prompts, '[]'::jsonb)
   WHERE id = v_profile_id;

  IF v_profile_status = 'published' THEN
    v_missing := public.guide_profile_missing_fields(v_profile_id);
    IF cardinality(v_missing) > 0 THEN
      UPDATE public.guide_profiles
         SET profile_status = 'draft',
             is_active = false
       WHERE id = v_profile_id;

      RETURN jsonb_build_object(
        'profile_status', 'draft',
        'auto_drafted', true,
        'missing', to_jsonb(v_missing)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'profile_status', v_profile_status,
    'auto_drafted', false,
    'missing', '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_my_guide_profile_tx(
  text, text, jsonb, text, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_my_guide_profile_tx(
  text, text, jsonb, text, text, text, jsonb
) TO authenticated;

-- Journal positions are authored order, not a best-effort sort hint.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY guide_profile_id
      ORDER BY position, created_at, id
    ) - 1 AS next_position
  FROM public.guide_profile_photos
  WHERE role = 'gallery'
)
UPDATE public.guide_profile_photos photos
   SET position = ranked.next_position::smallint
  FROM ranked
 WHERE photos.id = ranked.id
   AND photos.position <> ranked.next_position;

CREATE UNIQUE INDEX IF NOT EXISTS guide_profile_photos_unique_gallery_position
  ON public.guide_profile_photos(guide_profile_id, position)
  WHERE role = 'gallery';

CREATE OR REPLACE FUNCTION public.compact_guide_journal_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'gallery' THEN
    UPDATE public.guide_profile_photos
       SET position = position + 50
     WHERE guide_profile_id = OLD.guide_profile_id
       AND role = 'gallery'
       AND position > OLD.position;

    UPDATE public.guide_profile_photos
       SET position = position - 51
     WHERE guide_profile_id = OLD.guide_profile_id
       AND role = 'gallery'
       AND position > 50 + OLD.position;
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.compact_guide_journal_after_delete()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS compact_guide_journal_after_delete
  ON public.guide_profile_photos;
CREATE TRIGGER compact_guide_journal_after_delete
  AFTER DELETE ON public.guide_profile_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.compact_guide_journal_after_delete();

-- Text plus journal captions/order commit together. Uploading a new binary is
-- necessarily a prior Storage operation, but the authored profile state is one
-- database transaction.
CREATE OR REPLACE FUNCTION public.save_my_guide_profile_builder_tx(
  p_full_name text,
  p_bio text,
  p_languages jsonb,
  p_university text,
  p_hometown text,
  p_pull_quote text,
  p_prompts jsonb,
  p_gallery jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_gallery_count integer;
  v_result jsonb;
  v_item jsonb;
BEGIN
  IF jsonb_typeof(COALESCE(p_gallery, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'gallery_must_be_an_array';
  END IF;

  SELECT id
    INTO v_profile_id
    FROM public.guide_profiles
   WHERE user_id = v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guide_profile_not_found';
  END IF;

  v_gallery_count := jsonb_array_length(COALESCE(p_gallery, '[]'::jsonb));
  IF v_gallery_count > 12 THEN
    RAISE EXCEPTION 'journal_photo_limit_exceeded';
  END IF;

  IF v_gallery_count <> (
    SELECT count(*)::integer
      FROM public.guide_profile_photos
     WHERE guide_profile_id = v_profile_id
       AND role = 'gallery'
  ) THEN
    RAISE EXCEPTION 'journal_metadata_must_include_every_photo';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(COALESCE(p_gallery, '[]'::jsonb))
        AS item(value)
     WHERE jsonb_typeof(item.value) <> 'object'
        OR NULLIF(item.value->>'id', '') IS NULL
        OR (item.value->>'position') IS NULL
        OR (item.value->>'position')::integer < 0
        OR (item.value->>'position')::integer >= v_gallery_count
        OR NOT EXISTS (
          SELECT 1
            FROM public.guide_profile_photos photos
           WHERE photos.id = (item.value->>'id')::uuid
             AND photos.guide_profile_id = v_profile_id
             AND photos.role = 'gallery'
        )
  ) THEN
    RAISE EXCEPTION 'invalid_journal_metadata';
  END IF;

  IF (
    SELECT count(DISTINCT (item.value->>'position')::integer)
      FROM jsonb_array_elements(COALESCE(p_gallery, '[]'::jsonb))
        AS item(value)
  ) <> v_gallery_count THEN
    RAISE EXCEPTION 'journal_positions_must_be_unique';
  END IF;

  v_result := public.save_my_guide_profile_tx(
    p_full_name,
    p_bio,
    p_languages,
    p_university,
    p_hometown,
    p_pull_quote,
    p_prompts
  );

  -- Move the whole set out of the final range before assigning the requested
  -- order so swaps cannot collide with the partial unique index.
  UPDATE public.guide_profile_photos
     SET position = position + 50
   WHERE guide_profile_id = v_profile_id
     AND role = 'gallery';

  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_gallery, '[]'::jsonb))
  LOOP
    UPDATE public.guide_profile_photos
       SET position = (v_item->>'position')::smallint,
           caption = NULLIF(trim(v_item->>'caption'), '')
     WHERE id = (v_item->>'id')::uuid
       AND guide_profile_id = v_profile_id
       AND role = 'gallery';
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_my_guide_profile_builder_tx(
  text, text, jsonb, text, text, text, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_my_guide_profile_builder_tx(
  text, text, jsonb, text, text, text, jsonb, jsonb
) TO authenticated;

-- A published guide may replace the cover row in-place. Removing or re-roling
-- it atomically moves the profile to draft and pauses new inquiries.
CREATE OR REPLACE FUNCTION public.protect_published_guide_cover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'cover' THEN
      UPDATE public.guide_profiles
         SET profile_status = 'draft',
             is_active = false
       WHERE id = OLD.guide_profile_id
         AND profile_status = 'published';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.role = 'cover'
     AND (
       NEW.role <> 'cover'
       OR NEW.guide_profile_id <> OLD.guide_profile_id
     ) THEN
    UPDATE public.guide_profiles
       SET profile_status = 'draft',
           is_active = false
     WHERE id = OLD.guide_profile_id
       AND profile_status = 'published';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_published_guide_cover() FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_published_guide_cover
  ON public.guide_profile_photos;
CREATE TRIGGER protect_published_guide_cover
  BEFORE DELETE OR UPDATE OF role, guide_profile_id
  ON public.guide_profile_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_published_guide_cover();

CREATE OR REPLACE FUNCTION public.protect_published_guide_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NULLIF(trim(NEW.full_name), '') IS NULL
    OR NULLIF(trim(NEW.avatar_url), '') IS NULL
  )
  THEN
    UPDATE public.guide_profiles
       SET profile_status = 'draft',
           is_active = false
     WHERE user_id = OLD.id
       AND profile_status = 'published';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_published_guide_identity() FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_published_guide_identity
  ON public.users;
CREATE TRIGGER protect_published_guide_identity
  BEFORE UPDATE OF full_name, avatar_url ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_published_guide_identity();

-- Direct table UPDATE previously let an owner set lifecycle fields without the
-- gate. Builder/lifecycle writes now go through the SECURITY DEFINER RPCs.
REVOKE UPDATE ON public.guide_profiles FROM authenticated;

-- Publication, not current availability, determines whether explicitly
-- placed profile media is public. Explore still filters is_active.
DROP POLICY IF EXISTS "Public can read active guide profile photos"
  ON public.guide_profile_photos;
DROP POLICY IF EXISTS "Public can read published guide profile photos"
  ON public.guide_profile_photos;
CREATE POLICY "Public can read published guide profile photos"
  ON public.guide_profile_photos
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.guide_profiles gp
       WHERE gp.id = guide_profile_photos.guide_profile_id
         AND (
           gp.profile_status = 'published'
           OR gp.user_id = auth.uid()
         )
    )
  );
