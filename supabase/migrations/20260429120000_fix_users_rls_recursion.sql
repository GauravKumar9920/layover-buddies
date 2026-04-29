-- ============================================================================
-- FIX RLS INFINITE RECURSION ON public.users (2026-04-29)
-- ============================================================================
-- The original "Admins can read all users" policy queried public.users from
-- inside its own SELECT policy, causing infinite recursion:
--
--     ((SELECT users_1.role FROM users users_1 WHERE users_1.id = auth.uid())
--      = 'admin'::user_role)
--
-- Symptoms in the app:
--   - `[favorites] hydrate failed: infinite recursion detected in
--      policy for relation "users"`
--   - Admin reads of users table fail with SQLSTATE 42P17.
--
-- Fix: route the role lookup through a SECURITY DEFINER function. The function
-- bypasses RLS, so the policy can use it without re-entering users' policy
-- evaluation. SET search_path = public defends against search-path-hijack
-- (CVE class affecting SECURITY DEFINER funcs without an explicit path).
-- ============================================================================

DROP POLICY IF EXISTS "Admins can read all users" ON public.users;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');
