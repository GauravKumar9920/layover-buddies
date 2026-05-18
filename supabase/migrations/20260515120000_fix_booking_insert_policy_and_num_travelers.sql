-- ============================================================================
-- FIX BOOKING INSERT (permission denied for users) + ADD num_travelers (2026-05-15)
-- ============================================================================
-- Two problems are fixed here:
--
-- 1) "Travelers can create bookings" INSERT policy was written as:
--
--      WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'traveler'
--                  AND auth.uid() = traveler_id)
--
--    Migration 20260430130000 REVOKEd table-wide SELECT on public.users and
--    re-granted SELECT only on (id, full_name, avatar_url). The policy still
--    reads users.role, so every INSERT from an authenticated traveler fails
--    with:
--
--      ERROR: permission denied for table users  (SQLSTATE 42501)
--
--    Visible symptom: tapping "Confirm Booking" surfaces "Something went
--    wrong. Please try again." (the generic fallback in the catch block).
--
--    Fix: route the role lookup through public.get_my_role() — the same
--    SECURITY DEFINER helper introduced in migration 20260429120000 to break
--    the users RLS recursion. The function bypasses both RLS and the
--    column-level GRANTs, so the policy can check role without needing
--    SELECT (role) on public.users.
--
-- 2) The booking screen has a "Number of Travelers" counter but it was never
--    persisted — the bookings table had no column for it and the createBooking
--    API ignored the value. Pricing also didn't scale with group size.
--
--    Fix: add bookings.num_travelers (default 1, range 1..10 mirroring the
--    UI cap). The app-side cost multiplication is done client-side in
--    createBooking — keeping it server-trustable is a separate hardening
--    task once Razorpay verification lands.
-- ============================================================================

-- ── Part 1: replace the broken INSERT policy ───────────────────────────────
DROP POLICY IF EXISTS "Travelers can create bookings" ON public.bookings;

CREATE POLICY "Travelers can create bookings" ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'traveler'
    AND auth.uid() = traveler_id
  );

-- ── Part 2: add num_travelers column ────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS num_travelers INT NOT NULL DEFAULT 1
    CHECK (num_travelers >= 1 AND num_travelers <= 10);

COMMENT ON COLUMN public.bookings.num_travelers IS
  'Group size for the tour. Pricing on bookings.total_amount already reflects this multiplier.';
