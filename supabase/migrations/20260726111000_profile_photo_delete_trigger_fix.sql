-- A BEFORE DELETE trigger must return OLD for every role. Returning NEW on a
-- DELETE is NULL and silently cancels gallery deletion.
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
