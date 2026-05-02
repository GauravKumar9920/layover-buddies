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
--   1. Add a row-level policy that lets authenticated callers read any row
--      in public.users. anon (unauthenticated) is deliberately excluded —
--      the app requires sign-in before browsing, so there is no legitimate
--      unauthenticated use-case, and including anon would allow user
--      enumeration/scraping by anyone without an account.
--   2. Use Postgres column-level GRANTs to expose only the three fields every
--      PostgREST join actually requests (id, full_name, avatar_url). All other
--      columns (email, phone, role, is_verified, created_at, …) remain
--      inaccessible to the authenticated role. The admin panel uses the service
--      role key which bypasses both RLS and column-level GRANTs.
--
-- Why this is safe
-- ----------------
-- Every join in mobile/lib/api/ that touches public.users requests exactly
-- (id, full_name, avatar_url). No mobile query selects role, is_verified, or
-- created_at from this table — those fields come from guide_profiles or
-- supabase.auth.getUser() instead.
--
-- View safety
-- -----------
-- Column-level GRANTs on a table do NOT restrict what views can expose. The
-- initial schema defines views (e.g. active_guides) that include u.email.
-- If anon/authenticated hold SELECT on those views, email is still reachable
-- via PostgREST. We revoke SELECT on all views that include sensitive columns
-- so they remain admin-only (accessible via the service-role key).
-- ============================================================================

-- 1. Row-level policy: authenticated users can read any user's profile row.
CREATE POLICY "Authenticated read of profile rows" ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Drop the table-wide SELECT grant and re-grant only the three columns
--    every PostgREST join in the app actually needs. anon is intentionally
--    excluded — unauthenticated clients have no need to resolve user profiles.
REVOKE SELECT ON public.users FROM authenticated, anon;
GRANT SELECT (id, full_name, avatar_url)
  ON public.users
  TO authenticated;

-- 3. Revoke SELECT on admin-only views from authenticated/anon.
--    Each view is restricted for a different reason:
--      active_guides:          includes u.email, which bypasses the column-level
--                              GRANTs on public.users
--      pending_bookings:       exposes operational booking data (traveler_id,
--                              guide_id, amounts, status) — admin dashboard only
--      guide_earnings_summary: exposes financial aggregate data — admin only
REVOKE SELECT ON public.active_guides          FROM authenticated, anon;
REVOKE SELECT ON public.pending_bookings       FROM authenticated, anon;
REVOKE SELECT ON public.guide_earnings_summary FROM authenticated, anon;
