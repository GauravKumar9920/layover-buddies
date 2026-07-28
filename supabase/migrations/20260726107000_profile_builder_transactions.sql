-- ============================================================================
-- PROFILE BUILDER TRANSACTIONS
-- ============================================================================
-- Profile sections span users + role-specific tables. These RPCs keep a single
-- Save/Complete action atomic instead of leaving half-updated identity, trip,
-- or safety rows after a network/database failure.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_traveler_onboarding_tx(
  p_nationality text,
  p_gender text,
  p_arrival_at timestamptz,
  p_departure_at timestamptz,
  p_flight_in text DEFAULT NULL,
  p_flight_out text DEFAULT NULL,
  p_interests text[] DEFAULT ARRAY[]::text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_layover_id uuid;
  v_completed_at timestamptz := now();
BEGIN
  IF v_user_id IS NULL OR NOT public.account_is_active(v_user_id) THEN
    RAISE EXCEPTION 'not_authenticated_or_inactive';
  END IF;
  IF NULLIF(trim(p_nationality), '') IS NULL THEN
    RAISE EXCEPTION 'nationality_required';
  END IF;
  IF p_gender IS NOT NULL
     AND p_gender NOT IN ('female', 'male', 'non_binary', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'invalid_gender';
  END IF;
  IF p_departure_at <= p_arrival_at
     OR p_departure_at - p_arrival_at < interval '7 hours' THEN
    RAISE EXCEPTION 'layover_must_be_at_least_seven_hours';
  END IF;
  IF cardinality(COALESCE(p_interests, ARRAY[]::text[])) = 0 THEN
    RAISE EXCEPTION 'interest_required';
  END IF;

  INSERT INTO public.traveler_profiles (
    user_id,
    nationality,
    interests,
    onboarded_at,
    setup_completed_at,
    onboarding_version
  )
  VALUES (
    v_user_id,
    trim(p_nationality),
    p_interests,
    v_completed_at,
    v_completed_at,
    2
  )
  ON CONFLICT (user_id) DO UPDATE
  SET nationality = EXCLUDED.nationality,
      interests = EXCLUDED.interests,
      onboarded_at = EXCLUDED.onboarded_at,
      setup_completed_at = EXCLUDED.setup_completed_at,
      onboarding_version = EXCLUDED.onboarding_version;

  INSERT INTO public.traveler_safety_profiles (traveler_id, gender)
  VALUES (v_user_id, p_gender)
  ON CONFLICT (traveler_id) DO UPDATE
  SET gender = EXCLUDED.gender;

  SELECT id
    INTO v_layover_id
    FROM public.traveler_layovers
   WHERE traveler_id = v_user_id
     AND status = 'active'
   FOR UPDATE;

  IF v_layover_id IS NULL THEN
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
      'BOM',
      p_arrival_at,
      p_departure_at,
      NULLIF(trim(p_flight_in), ''),
      NULLIF(trim(p_flight_out), ''),
      1,
      'active'
    );
  ELSE
    UPDATE public.traveler_layovers
       SET arrival_at = p_arrival_at,
           departure_at = p_departure_at,
           flight_in = NULLIF(trim(p_flight_in), ''),
           flight_out = NULLIF(trim(p_flight_out), '')
     WHERE id = v_layover_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_traveler_onboarding_tx(
  text, text, timestamptz, timestamptz, text, text, text[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_traveler_onboarding_tx(
  text, text, timestamptz, timestamptz, text, text, text[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_my_traveler_profile_tx(p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_unknown jsonb;
  v_layover_id uuid;
BEGIN
  IF v_user_id IS NULL OR NOT public.account_is_active(v_user_id) THEN
    RAISE EXCEPTION 'not_authenticated_or_inactive';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'invalid_profile_patch';
  END IF;

  v_unknown := p_patch - ARRAY[
    'full_name', 'avatar_url',
    'nationality', 'preferred_language', 'interests', 'about_me',
    'travel_pace', 'dietary_preferences', 'accessibility_notes',
    'arrival_at', 'departure_at', 'flight_in', 'flight_out',
    'airport_code', 'group_size',
    'gender', 'emergency_contact_name', 'emergency_contact_phone'
  ]::text[];
  IF v_unknown <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unknown_profile_fields';
  END IF;

  IF p_patch ? 'full_name'
     AND NULLIF(trim(p_patch->>'full_name'), '') IS NULL THEN
    RAISE EXCEPTION 'full_name_required';
  END IF;
  IF p_patch ? 'travel_pace'
     AND p_patch->'travel_pace' <> 'null'::jsonb
     AND p_patch->>'travel_pace' NOT IN ('relaxed', 'balanced', 'packed') THEN
    RAISE EXCEPTION 'invalid_travel_pace';
  END IF;
  IF p_patch ? 'group_size'
     AND (p_patch->>'group_size')::integer NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid_group_size';
  END IF;

  IF p_patch ? 'full_name' OR p_patch ? 'avatar_url' THEN
    UPDATE public.users
       SET full_name = CASE
             WHEN p_patch ? 'full_name' THEN trim(p_patch->>'full_name')
             ELSE full_name
           END,
           avatar_url = CASE
             WHEN p_patch ? 'avatar_url' THEN NULLIF(p_patch->>'avatar_url', '')
             ELSE avatar_url
           END
     WHERE id = v_user_id;
  END IF;

  INSERT INTO public.traveler_profiles (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.traveler_profiles
     SET nationality = CASE
           WHEN p_patch ? 'nationality' THEN NULLIF(trim(p_patch->>'nationality'), '')
           ELSE nationality
         END,
         preferred_language = CASE
           WHEN p_patch ? 'preferred_language'
             THEN NULLIF(trim(p_patch->>'preferred_language'), '')
           ELSE preferred_language
         END,
         interests = CASE
           WHEN p_patch ? 'interests'
             THEN ARRAY(
               SELECT jsonb_array_elements_text(
                 COALESCE(p_patch->'interests', '[]'::jsonb)
               )
             )
           ELSE interests
         END,
         about_me = CASE
           WHEN p_patch ? 'about_me' THEN NULLIF(trim(p_patch->>'about_me'), '')
           ELSE about_me
         END,
         travel_pace = CASE
           WHEN p_patch ? 'travel_pace' THEN NULLIF(p_patch->>'travel_pace', '')
           ELSE travel_pace
         END,
         dietary_preferences = CASE
           WHEN p_patch ? 'dietary_preferences'
             THEN ARRAY(
               SELECT jsonb_array_elements_text(
                 COALESCE(p_patch->'dietary_preferences', '[]'::jsonb)
               )
             )
           ELSE dietary_preferences
         END,
         accessibility_notes = CASE
           WHEN p_patch ? 'accessibility_notes'
             THEN NULLIF(trim(p_patch->>'accessibility_notes'), '')
           ELSE accessibility_notes
         END
   WHERE user_id = v_user_id;

  IF p_patch ?| ARRAY[
    'arrival_at', 'departure_at', 'flight_in', 'flight_out',
    'airport_code', 'group_size'
  ] THEN
    SELECT id
      INTO v_layover_id
      FROM public.traveler_layovers
     WHERE traveler_id = v_user_id
       AND status = 'active'
     FOR UPDATE;

    IF v_layover_id IS NULL THEN
      RAISE EXCEPTION 'active_layover_required';
    END IF;

    UPDATE public.traveler_layovers
       SET arrival_at = CASE
             WHEN p_patch ? 'arrival_at' THEN (p_patch->>'arrival_at')::timestamptz
             ELSE arrival_at
           END,
           departure_at = CASE
             WHEN p_patch ? 'departure_at' THEN (p_patch->>'departure_at')::timestamptz
             ELSE departure_at
           END,
           flight_in = CASE
             WHEN p_patch ? 'flight_in' THEN NULLIF(trim(p_patch->>'flight_in'), '')
             ELSE flight_in
           END,
           flight_out = CASE
             WHEN p_patch ? 'flight_out' THEN NULLIF(trim(p_patch->>'flight_out'), '')
             ELSE flight_out
           END,
           airport_code = CASE
             WHEN p_patch ? 'airport_code' THEN upper(trim(p_patch->>'airport_code'))
             ELSE airport_code
           END,
           group_size = CASE
             WHEN p_patch ? 'group_size' THEN (p_patch->>'group_size')::smallint
             ELSE group_size
           END
     WHERE id = v_layover_id;
  END IF;

  IF p_patch ?| ARRAY[
    'gender', 'emergency_contact_name', 'emergency_contact_phone'
  ] THEN
    INSERT INTO public.traveler_safety_profiles (traveler_id)
    VALUES (v_user_id)
    ON CONFLICT (traveler_id) DO NOTHING;

    UPDATE public.traveler_safety_profiles
       SET gender = CASE
             WHEN p_patch ? 'gender' THEN NULLIF(p_patch->>'gender', '')
             ELSE gender
           END,
           emergency_contact_name = CASE
             WHEN p_patch ? 'emergency_contact_name'
               THEN NULLIF(trim(p_patch->>'emergency_contact_name'), '')
             ELSE emergency_contact_name
           END,
           emergency_contact_phone = CASE
             WHEN p_patch ? 'emergency_contact_phone'
               THEN NULLIF(trim(p_patch->>'emergency_contact_phone'), '')
             ELSE emergency_contact_phone
           END
     WHERE traveler_id = v_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_my_traveler_profile_tx(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_my_traveler_profile_tx(jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_my_guide_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.guide_profiles%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF v_user_id IS NULL OR NOT public.account_is_active(v_user_id) THEN
    RAISE EXCEPTION 'not_authenticated_or_inactive';
  END IF;

  SELECT * INTO v_profile
    FROM public.guide_profiles
   WHERE user_id = v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guide_profile_not_found';
  END IF;

  SELECT * INTO v_user
    FROM public.users
   WHERE id = v_user_id;

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
  IF jsonb_array_length(COALESCE(v_profile.languages, '[]'::jsonb)) = 0 THEN
    v_missing := array_append(v_missing, 'language');
  END IF;
  IF jsonb_array_length(COALESCE(v_profile.prompts, '[]'::jsonb)) = 0 THEN
    v_missing := array_append(v_missing, 'story answer');
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.guide_profile_photos
     WHERE guide_profile_id = v_profile.id
       AND role = 'cover'
  ) THEN
    v_missing := array_append(v_missing, 'profile cover');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RETURN jsonb_build_object(
      'published', false,
      'missing', to_jsonb(v_missing)
    );
  END IF;

  UPDATE public.guide_profiles
     SET profile_status = 'published',
         profile_completed_at = COALESCE(profile_completed_at, now())
   WHERE id = v_profile.id;

  RETURN jsonb_build_object(
    'published', true,
    'missing', '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_my_guide_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_my_guide_profile() TO authenticated;
