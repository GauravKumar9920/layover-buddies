-- ============================================================================
-- FIX favorites HEART TOGGLE (permission denied for users) — 2026-05-16
-- ============================================================================
-- Symptom
-- -------
-- Tapping the heart on an itinerary or guide card optimistically turns red,
-- then snaps back to white a moment later. Console shows:
--
--   [favorites] toggle failed, reverting: permission denied for table users
--
-- Cause
-- -----
-- The favorites upsert is sent with `Prefer: return=representation`, so
-- PostgREST runs a SELECT on the new row after the INSERT. RLS evaluates
-- every SELECT policy on `favorites`, including `favorites_admin_read_all`,
-- which was written as:
--
--     EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid()
--                                   AND u.role = 'admin')
--
-- Migration 20260430130000 REVOKEd table-wide SELECT on public.users and
-- only re-granted (id, full_name, avatar_url). The policy still tries to
-- read users.role, fails with SQLSTATE 42501, the optimistic flip in the
-- favorites store rolls back, and the heart turns white again.
--
-- Fix
-- ---
-- Route the role lookup through public.get_my_role() — the SECURITY DEFINER
-- helper introduced by 20260429120000 to break the same users-RLS recursion
-- on a sibling policy. The function bypasses both RLS and column-level
-- GRANTs, so the policy can check admin role without needing SELECT(role)
-- on public.users.
-- ============================================================================

DROP POLICY IF EXISTS "favorites_admin_read_all" ON public.favorites;

CREATE POLICY "favorites_admin_read_all" ON public.favorites
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');
