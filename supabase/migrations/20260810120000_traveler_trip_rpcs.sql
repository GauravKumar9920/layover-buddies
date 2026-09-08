-- ============================================================================
-- TRAVELER TRIP RPCs — age band, party type, 4-person parties
-- ============================================================================
-- complete_traveler_onboarding_tx and create_my_next_layover gain parameters.
--
-- A function's identity in Postgres is (name, argument type list). CREATE OR
-- REPLACE with a DIFFERENT list does not replace — it creates a second,
-- overloaded function. And because the new parameters carry defaults, an
-- existing 7-argument call would then match BOTH functions and fail with
--   42725  function public.complete_traveler_onboarding_tx(...) is not unique
-- So the old signatures are dropped explicitly first. Verified beforehand that
-- nothing depends on either function (pg_depend returned zero rows), so no
-- CASCADE is needed or wanted.
--
-- save_my_traveler_profile_tx(jsonb) keeps its signature — everything travels
-- through the jsonb patch — so it is a plain CREATE OR REPLACE, no DROP.
-- ============================================================================

-- Dropped by catalog lookup rather than by spelling out the old argument list.
-- Naming the old signature works exactly once: on a database where this
-- migration has already run, the old signature is gone, the DROP silently
-- no-ops, and the CREATE below then fails with "already exists with same
-- argument types". Enumerating every overload of the name is idempotent and
-- also cleans up any stray overload left by an interrupted earlier run.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('complete_traveler_onboarding_tx',
                         'create_my_next_layover')
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

-- ── complete_traveler_onboarding_tx ─────────────────────────────────────────
-- New parameters are APPENDED with defaults so a client build that has not
-- shipped yet keeps working against this function.

CREATE FUNCTION public.complete_traveler_onboarding_tx(
  p_nationality  text,
  p_gender       text,
  p_arrival_at   timestamptz,
  p_departure_at timestamptz,
  p_flight_in    text     DEFAULT NULL,
  p_flight_out   text     DEFAULT NULL,
  p_interests    text[]   DEFAULT ARRAY[]::text[],
  p_age_band     text     DEFAULT NULL,
  p_party_type   text     DEFAULT NULL,
  p_group_size   smallint DEFAULT 1
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
  IF p_age_band IS NOT NULL
     AND p_age_band NOT IN ('18_24', '25_34', '35_49', '50_64', '65_plus') THEN
    RAISE EXCEPTION 'invalid_age_band';
  END IF;
  IF p_party_type IS NOT NULL
     AND p_party_type NOT IN ('solo', 'couple', 'family', 'friends') THEN
    RAISE EXCEPTION 'invalid_party_type';
  END IF;
  IF p_group_size IS NULL OR p_group_size NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_group_size';
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
    age_band,
    onboarded_at,
    setup_completed_at,
    onboarding_version
  )
  VALUES (
    v_user_id,
    trim(p_nationality),
    p_interests,
    p_age_band,
    v_completed_at,
    v_completed_at,
    3
  )
  ON CONFLICT (user_id) DO UPDATE
  SET nationality = EXCLUDED.nationality,
      interests = EXCLUDED.interests,
      age_band = EXCLUDED.age_band,
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
      party_type,
      status
    )
    VALUES (
      v_user_id,
      'BOM',
      p_arrival_at,
      p_departure_at,
      NULLIF(trim(p_flight_in), ''),
      NULLIF(trim(p_flight_out), ''),
      p_group_size,
      p_party_type,
      'active'
    );
  ELSE
    -- The previous version of this branch never touched group_size, so
    -- re-running onboarding left a stale party size on the active layover.
    -- Both new fields are written here for the same reason.
    UPDATE public.traveler_layovers
       SET arrival_at = p_arrival_at,
           departure_at = p_departure_at,
           flight_in = NULLIF(trim(p_flight_in), ''),
           flight_out = NULLIF(trim(p_flight_out), ''),
           group_size = p_group_size,
           party_type = p_party_type
     WHERE id = v_layover_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_traveler_onboarding_tx(
  text, text, timestamptz, timestamptz, text, text, text[], text, text, smallint
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_traveler_onboarding_tx(
  text, text, timestamptz, timestamptz, text, text, text[], text, text, smallint
) TO authenticated;

-- ── create_my_next_layover ──────────────────────────────────────────────────
-- Unchanged from 20260726109000 apart from: p_party_type appended, the party
-- cap widened to 4, and party_type written into the new row.

CREATE FUNCTION public.create_my_next_layover(
  p_arrival_at timestamptz,
  p_departure_at timestamptz,
  p_flight_in text DEFAULT NULL,
  p_flight_out text DEFAULT NULL,
  p_group_size smallint DEFAULT 1,
  p_airport_code text DEFAULT 'BOM',
  p_party_type text DEFAULT NULL
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
  IF p_group_size NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_group_size';
  END IF;
  IF p_party_type IS NOT NULL
     AND p_party_type NOT IN ('solo', 'couple', 'family', 'friends') THEN
    RAISE EXCEPTION 'invalid_party_type';
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
    party_type,
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
    p_party_type,
    'active'
  )
  RETURNING id INTO v_layover_id;

  RETURN v_layover_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_next_layover(
  timestamptz, timestamptz, text, text, smallint, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_my_next_layover(
  timestamptz, timestamptz, text, text, smallint, text, text
) TO authenticated;

-- ── save_my_traveler_profile_tx ─────────────────────────────────────────────
-- Signature unchanged. Four additions against 20260726107000:
--   1. age_band + party_type join the allow-list and gain domain guards
--   2. the party cap widens 3 → 4
--   3. age_band is written to traveler_profiles, party_type to the layover
--   4. the 7-hour minimum is enforced on this path too — see below

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
  v_next_arrival_at timestamptz;
  v_next_departure_at timestamptz;
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
    'travel_pace', 'dietary_preferences', 'accessibility_notes', 'age_band',
    'arrival_at', 'departure_at', 'flight_in', 'flight_out',
    'airport_code', 'group_size', 'party_type',
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
  IF p_patch ? 'age_band'
     AND p_patch->'age_band' <> 'null'::jsonb
     AND p_patch->>'age_band' NOT IN
       ('18_24', '25_34', '35_49', '50_64', '65_plus') THEN
    RAISE EXCEPTION 'invalid_age_band';
  END IF;
  IF p_patch ? 'party_type'
     AND p_patch->'party_type' <> 'null'::jsonb
     AND p_patch->>'party_type' NOT IN
       ('solo', 'couple', 'family', 'friends') THEN
    RAISE EXCEPTION 'invalid_party_type';
  END IF;
  IF p_patch ? 'group_size'
     AND (p_patch->>'group_size')::integer NOT BETWEEN 1 AND 4 THEN
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
         END,
         age_band = CASE
           WHEN p_patch ? 'age_band' THEN NULLIF(p_patch->>'age_band', '')
           ELSE age_band
         END
   WHERE user_id = v_user_id;

  IF p_patch ?| ARRAY[
    'arrival_at', 'departure_at', 'flight_in', 'flight_out',
    'airport_code', 'group_size', 'party_type'
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

    -- Normalize the eligibility error before writing.
    --
    -- The 7-hour minimum is already enforced by the table CHECK
    -- traveler_layovers_minimum_window (20260726109000), so this is not a
    -- security hole being closed — the database rejects a short window on
    -- every path. What it is NOT is a usable error: the client would get a
    -- raw 23514 naming an internal constraint, whereas
    -- complete_traveler_onboarding_tx and create_my_next_layover both raise
    -- 'layover_must_be_at_least_seven_hours'. Since "Edit trip details" on
    -- the booking screen routes here, all three write paths should fail the
    -- same way for the same reason.
    --
    -- Merged against the stored row, not the patch alone: a patch that moves
    -- only arrival_at has to be judged against the departure_at on record.
    IF p_patch ?| ARRAY['arrival_at', 'departure_at'] THEN
      SELECT
        CASE WHEN p_patch ? 'arrival_at'
             THEN (p_patch->>'arrival_at')::timestamptz ELSE l.arrival_at END,
        CASE WHEN p_patch ? 'departure_at'
             THEN (p_patch->>'departure_at')::timestamptz ELSE l.departure_at END
        INTO v_next_arrival_at, v_next_departure_at
        FROM public.traveler_layovers l
       WHERE l.id = v_layover_id;

      IF v_next_departure_at <= v_next_arrival_at
         OR v_next_departure_at - v_next_arrival_at < interval '7 hours' THEN
        RAISE EXCEPTION 'layover_must_be_at_least_seven_hours';
      END IF;
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
           END,
           party_type = CASE
             WHEN p_patch ? 'party_type' THEN NULLIF(p_patch->>'party_type', '')
             ELSE party_type
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

NOTIFY pgrst, 'reload schema';
