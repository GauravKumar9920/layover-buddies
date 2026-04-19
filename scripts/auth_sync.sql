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

  inferred_role := CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.guide_profiles gp
      WHERE gp.user_id = source_user.id
        AND gp.is_active = TRUE
    ) THEN 'guide'::user_role
    ELSE 'traveler'::user_role
  END;

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

  IF inferred_role = 'traveler' THEN
    INSERT INTO public.traveler_profiles (user_id)
    VALUES (source_user.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.handle_new_auth_user_sync(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.sync_current_auth_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_auth_user auth.users%ROWTYPE;
BEGIN
  SELECT * INTO current_auth_user
  FROM auth.users
  WHERE id = auth.uid();

  IF current_auth_user.id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found in auth.users';
  END IF;

  PERFORM public.handle_new_auth_user_sync(current_auth_user.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_public_users_from_auth()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  processed_count INT := 0;
  source_user RECORD;
BEGIN
  FOR source_user IN
    SELECT id
    FROM auth.users
  LOOP
    PERFORM public.handle_new_auth_user_sync(source_user.id);
    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_current_auth_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_current_auth_user() TO authenticated;

SELECT public.backfill_public_users_from_auth() AS backfilled_users;
