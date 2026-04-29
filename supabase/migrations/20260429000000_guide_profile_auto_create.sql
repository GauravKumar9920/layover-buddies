-- ============================================================================
-- GUIDE SIGNUP FIX (2026-04-29)
-- Auto-provision guide_profiles rows when a guide signs up.
-- Adds INSERT RLS policy (defense-in-depth) and relaxes university NOT NULL
-- so self-serve guide accounts don't need pre-verified education details.
-- ============================================================================

-- Self-serve guide signup: university is filled in later via profile edit.
ALTER TABLE guide_profiles
  ALTER COLUMN university DROP NOT NULL;

-- Defense-in-depth: lets a guide create their own profile row if the trigger
-- ever fails to (e.g., role metadata missing). The auth-sync function below
-- runs as SECURITY DEFINER and will normally handle it.
DROP POLICY IF EXISTS "Users can create own guide profile" ON guide_profiles;
CREATE POLICY "Users can create own guide profile" ON guide_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Replace handle_new_auth_user_sync to honor signup intent (raw_user_meta_data.role)
-- and create the matching profile row.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user_sync(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  source_user auth.users%ROWTYPE;
  provider_text TEXT;
  provider_value auth_provider;
  derived_name TEXT;
  metadata_role TEXT;
  has_guide_profile BOOLEAN;
  inferred_role user_role;
BEGIN
  SELECT * INTO source_user
  FROM auth.users
  WHERE id = target_user_id;

  IF source_user.id IS NULL THEN
    RAISE EXCEPTION 'User % not found in auth.users', target_user_id;
  END IF;

  provider_text := COALESCE(source_user.raw_app_meta_data->>'provider', 'email');
  provider_value := CASE
    WHEN provider_text = 'google' THEN 'google'::auth_provider
    WHEN provider_text = 'apple' THEN 'apple'::auth_provider
    ELSE 'email'::auth_provider
  END;

  metadata_role := NULLIF(BTRIM(source_user.raw_user_meta_data->>'role'), '');

  SELECT EXISTS (
    SELECT 1
    FROM public.guide_profiles gp
    WHERE gp.user_id = source_user.id
  ) INTO has_guide_profile;

  -- A guide signup intent OR an existing profile row both mark the user as a guide.
  IF metadata_role = 'guide' OR has_guide_profile THEN
    inferred_role := 'guide'::user_role;
  ELSE
    inferred_role := 'traveler'::user_role;
  END IF;

  derived_name := COALESCE(
    NULLIF(BTRIM(source_user.raw_user_meta_data->>'full_name'), ''),
    NULLIF(SPLIT_PART(COALESCE(source_user.email, source_user.id::text), '@', 1), ''),
    'Traveler'
  );

  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    auth_provider,
    is_verified
  )
  VALUES (
    source_user.id,
    COALESCE(source_user.email, source_user.id::text || '@mumbai-buddies.local'),
    derived_name,
    inferred_role,
    provider_value,
    source_user.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.users.full_name, ''), EXCLUDED.full_name),
    role = EXCLUDED.role,
    auth_provider = EXCLUDED.auth_provider,
    is_verified = public.users.is_verified OR EXCLUDED.is_verified,
    updated_at = now();

  IF inferred_role = 'guide' THEN
    -- Provision a placeholder guide_profiles row. Guide fills in details later
    -- via the in-app profile editor (university, bio, languages, etc.).
    INSERT INTO public.guide_profiles (user_id, is_active)
    VALUES (source_user.id, TRUE)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.traveler_profiles (user_id)
    VALUES (source_user.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

-- Backfill: heal any existing accounts that were created before this fix shipped.
SELECT public.backfill_public_users_from_auth() AS backfilled_users;
