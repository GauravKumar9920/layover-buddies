-- Keep the guide builder's users + guide_profiles write atomic.

CREATE OR REPLACE FUNCTION public.save_my_guide_profile_tx(
  p_full_name text,
  p_bio text,
  p_languages jsonb,
  p_university text,
  p_hometown text,
  p_pull_quote text,
  p_prompts jsonb
)
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
  IF NULLIF(trim(p_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'full_name_required';
  END IF;
  IF jsonb_typeof(COALESCE(p_languages, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'languages_must_be_an_array';
  END IF;
  IF jsonb_typeof(COALESCE(p_prompts, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'prompts_must_be_an_array';
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
   WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guide_profile_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_my_guide_profile_tx(
  text, text, jsonb, text, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_my_guide_profile_tx(
  text, text, jsonb, text, text, text, jsonb
) TO authenticated;
