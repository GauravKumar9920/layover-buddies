-- RLS policy subqueries cannot read users.role through the deliberately narrow
-- authenticated column grants. Resolve the current account's role inside one
-- audited SECURITY DEFINER helper instead.

CREATE OR REPLACE FUNCTION public.current_account_has_role(
  p_role public.user_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = auth.uid()
       AND u.role = p_role
       AND u.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.current_account_has_role(public.user_role)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_account_has_role(public.user_role)
  TO authenticated;

DROP POLICY IF EXISTS "Travelers can create own traveler profile"
  ON public.traveler_profiles;
CREATE POLICY "Travelers can create own traveler profile"
  ON public.traveler_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.account_is_active(auth.uid())
    AND public.current_account_has_role('traveler')
  );

DROP POLICY IF EXISTS "Travelers can update own traveler profile"
  ON public.traveler_profiles;
CREATE POLICY "Travelers can update own traveler profile"
  ON public.traveler_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.account_is_active(auth.uid())
    AND public.current_account_has_role('traveler')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.account_is_active(auth.uid())
    AND public.current_account_has_role('traveler')
  );

DROP POLICY IF EXISTS "Guides can create own guide profile"
  ON public.guide_profiles;
CREATE POLICY "Guides can create own guide profile"
  ON public.guide_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.account_is_active(auth.uid())
    AND public.current_account_has_role('guide')
  );
