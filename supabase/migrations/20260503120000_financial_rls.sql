-- ============================================================================
-- FINANCIAL MODEL — RLS POLICIES (Phase 1, Migration 3 of 3)
-- ============================================================================
-- Secures the six new financial tables created in 20260503100000_financial_core.sql.
--
-- Policy pattern matches 20260418121000_rls_policy_coverage.sql:
--   DROP POLICY IF EXISTS … ; CREATE POLICY … for safe re-runs (idempotent).
--
-- Helper function user_can_see_booking(b_id uuid) centralises the check that
-- the calling user is either the traveler or the guide on a booking. Used in
-- every USING/WITH CHECK clause below.
--
-- Name adjustment vs handoff §5 Migration 3:
--   payouts → payout_dispatches  (handoff used old name; we renamed to avoid
--                                  collision with existing payouts request table)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────
-- Enable RLS on the six new tables
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE agreements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_line_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_proofs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_dispatches ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- Helper: link booking → user_ids on both sides
-- ─────────────────────────────────────────────────────────────────
-- SET search_path pins the function's resolution context so that a rogue
-- schema earlier in the default search path cannot shadow `bookings` or
-- `auth` (PostgreSQL CVE-2018-1058 mitigation). auth.uid() is schema-
-- qualified in the call so it resolves correctly even with a pinned path.
CREATE OR REPLACE FUNCTION user_can_see_booking(b_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = b_id
      AND (b.traveler_id = auth.uid() OR b.guide_id = auth.uid())
  );
$$;

-- ─────────────────────────────────────────────────────────────────
-- agreements
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "agreements_read"            ON agreements;
CREATE POLICY "agreements_read" ON agreements
  FOR SELECT
  USING (user_can_see_booking(booking_id));

DROP POLICY IF EXISTS "agreements_write_buddy"     ON agreements;
CREATE POLICY "agreements_write_buddy" ON agreements
  FOR INSERT
  WITH CHECK (drafted_by_user_id = auth.uid());

DROP POLICY IF EXISTS "agreements_update_parties"  ON agreements;
CREATE POLICY "agreements_update_parties" ON agreements
  FOR UPDATE
  USING (user_can_see_booking(booking_id));

-- ─────────────────────────────────────────────────────────────────
-- cost_line_items
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "line_items_read"             ON cost_line_items;
CREATE POLICY "line_items_read" ON cost_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agreements a
      WHERE a.id = cost_line_items.agreement_id
        AND user_can_see_booking(a.booking_id)
    )
  );

DROP POLICY IF EXISTS "line_items_write_buddy"      ON cost_line_items;
CREATE POLICY "line_items_write_buddy" ON cost_line_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agreements a
      WHERE a.id = cost_line_items.agreement_id
        AND a.drafted_by_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- deposits
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deposits_read"               ON deposits;
CREATE POLICY "deposits_read" ON deposits
  FOR SELECT
  USING (user_can_see_booking(booking_id));

-- ─────────────────────────────────────────────────────────────────
-- payment_events
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "payment_events_read"         ON payment_events;
CREATE POLICY "payment_events_read" ON payment_events
  FOR SELECT
  USING (user_can_see_booking(booking_id));

-- ─────────────────────────────────────────────────────────────────
-- expense_proofs
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "expense_proofs_read"         ON expense_proofs;
CREATE POLICY "expense_proofs_read" ON expense_proofs
  FOR SELECT
  USING (user_can_see_booking(booking_id));

DROP POLICY IF EXISTS "expense_proofs_write_buddy"  ON expense_proofs;
CREATE POLICY "expense_proofs_write_buddy" ON expense_proofs
  FOR INSERT
  WITH CHECK (uploaded_by_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- payout_dispatches  (renamed from handoff's `payouts`)
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "payout_dispatches_read"      ON payout_dispatches;
CREATE POLICY "payout_dispatches_read" ON payout_dispatches
  FOR SELECT
  USING (user_can_see_booking(booking_id));

-- ─────────────────────────────────────────────────────────────────
-- Note on INSERT/UPDATE/DELETE for the financial tables
-- ─────────────────────────────────────────────────────────────────
-- deposits, payment_events, and payout_dispatches intentionally have
-- no INSERT/UPDATE policies for the authenticated role. All writes to
-- these tables are performed by Razorpay webhook Edge Functions running
-- under the service-role key, which bypasses RLS entirely. This is
-- verified by design in Phase 2; any attempt to write from an anon or
-- authenticated JWT will be silently blocked by the absence of a write
-- policy, rather than returning an explicit permission error.
-- expense_proofs and agreements do have write policies (buddy-scoped
-- INSERT) since those are written from the mobile client directly.
