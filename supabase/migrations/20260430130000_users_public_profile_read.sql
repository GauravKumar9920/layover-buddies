-- ============================================================================
-- PUBLIC READ OF SAFE USER PROFILE FIELDS (2026-04-30)
-- ============================================================================
-- Problem
-- -------
-- The existing RLS only lets a user read their own row in `public.users`
-- (`auth.uid() = id`) plus a separate admin-read policy. Every PostgREST join
-- like `users:users!user_id(id, full_name, avatar_url)` therefore returns
-- nothing for any user other than the caller themself.
--
-- Visible symptoms in the app:
--   - Guide cards on Explore display "{University} Guide" (the fallback in
--     normalizeGuideProfile) instead of the actual guide's name.
--   - Searching for a guide by name returns nothing because guide.name has
--     fallen back to the university string.
--   - Avatars never render on profile pages.
--   - Inbox conversation rows show "Guide" / "Traveler" instead of names.
--
-- Fix
-- ---
-- Two-part change:
--   1. Add a row-level policy that lets authenticated AND anonymous callers
--      read any row in public.users.
--   2. Use Postgres column-level GRANTs to keep `email` and `phone` private —
--      the `authenticated` and `anon` roles can only SELECT a small set of
--      profile columns. Everything else (admin pages, server-side functions
--      with SECURITY DEFINER, the service role) is unaffected.
--
-- Why this is safe
-- ----------------
-- The mobile client does not read `email` or `phone` from public.users — it
-- gets the current user's email/phone from `supabase.auth.getUser()` (which
-- talks to auth.users, a separate table). A grep of `mobile/lib/` and
-- `mobile/app/` confirms no `select('email')` or `select('phone')` against
-- `public.users` anywhere. The admin panel uses the service role key, which
-- bypasses both RLS and column-level GRANTs.
--
-- View safety
-- -----------
-- Column-level GRANTs on a table do NOT restrict what views can expose. The
-- initial schema defines views (e.g. active_guides) that include u.email.
-- If anon/authenticated hold SELECT on those views, email is still reachable
-- via PostgREST. We revoke SELECT on all views that include sensitive columns
-- so they remain admin-only (accessible via the service-role key).
-- ============================================================================

-- 1. Row-level policy: anyone can read user rows. The column GRANT below is
--    what actually keeps the sensitive columns private.
CREATE POLICY "Public read of profile rows" ON public.users
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- 2. Drop the table-wide SELECT grant from authenticated/anon and re-grant
--    only the safe columns. After this, attempting to SELECT email or phone
--    from public.users as an authenticated/anon role will return a permission
--    error from PostgREST; callers must request only the granted columns.
REVOKE SELECT ON public.users FROM authenticated, anon;
GRANT SELECT (id, full_name, avatar_url, role, is_verified, created_at)
  ON public.users
  TO authenticated, anon;

-- 3. Revoke SELECT on views that expose email/phone so they cannot bypass
--    the column-level GRANTs above. These views are used by the admin panel
--    (service role) only — anon/authenticated have no legitimate need for them.
REVOKE SELECT ON public.active_guides         FROM authenticated, anon;
REVOKE SELECT ON public.pending_bookings      FROM authenticated, anon;
REVOKE SELECT ON public.guide_earnings_summary FROM authenticated, anon;
