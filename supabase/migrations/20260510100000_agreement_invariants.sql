-- ============================================================================
-- AGREEMENT INVARIANTS (Phase 2, Migration 1 of 1)
-- ============================================================================
-- Belt-and-braces guards on the `agreements` table introduced in Phase 1.
-- Phase 2 wires the buddy-side drafting UI and the sign Edge function — both
-- write into `agreements`. The constraints below pin the canonical formulas
-- so a malformed client-side write (e.g. a stale build that miscomputes the
-- buffer) cannot persist a row that violates the §2 worked example.
--
-- Constraints are additive and idempotent. No Phase 1 row is altered (the
-- `agreements` table has no rows yet — Phase 1 only created it).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────
-- Buffer is exactly 20% of itinerary fund (floor, integer paise).
-- Mirrors the validation in mobile/lib/booking/agreementSnapshot.ts.
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE agreements
    ADD CONSTRAINT agreements_buffer_is_20_pct
    CHECK (buffer_paise = floor(itinerary_fund_paise * 0.20));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- Traveler total = subtotal + GST + ₹500 deposit (canonical formula).
-- The deposit is hard-coded at 50_000 paise per Phase 1 §5 and the
-- DEPOSIT_PAISE constant in mobile/config/constants.ts.
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE agreements
    ADD CONSTRAINT agreements_total_matches_formula
    CHECK (traveler_total_paise = traveler_subtotal_paise + traveler_gst_paise + 50000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- Index for the buddy-side drafting screen.
-- Query: SELECT * FROM agreements
--          WHERE drafted_by_user_id = auth.uid() AND status = 'draft';
-- Also serves the "fetch draft for booking" lookup in the drafting flow.
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agreements_drafted_by_status
  ON agreements (drafted_by_user_id, status);

-- ─────────────────────────────────────────────────────────────────
-- RPC: sign_agreement_tx — atomic sign + status advance
-- Used by the sign-agreement Edge Function so the timestamp write and the
-- agreement-status transition happen in one transaction (preventing a
-- half-signed state if the function crashes between writes).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sign_agreement_tx(
  p_agreement_id uuid,
  p_side text  -- 'traveler' | 'buddy'
)
RETURNS TABLE (
  agreement_status agreement_status,
  both_signatures_present boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_traveler_signed_at timestamptz;
  v_buddy_signed_at    timestamptz;
  v_new_status         agreement_status;
  v_both               boolean;
BEGIN
  -- Lock the row, write the timestamp, re-read, decide status.
  IF p_side = 'traveler' THEN
    UPDATE agreements
       SET traveler_signed_at = COALESCE(traveler_signed_at, now()),
           updated_at         = now()
     WHERE id = p_agreement_id
     RETURNING traveler_signed_at, buddy_signed_at
       INTO v_traveler_signed_at, v_buddy_signed_at;
  ELSIF p_side = 'buddy' THEN
    UPDATE agreements
       SET buddy_signed_at = COALESCE(buddy_signed_at, now()),
           updated_at      = now()
     WHERE id = p_agreement_id
     RETURNING traveler_signed_at, buddy_signed_at
       INTO v_traveler_signed_at, v_buddy_signed_at;
  ELSE
    RAISE EXCEPTION 'invalid side: %', p_side;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agreement % not found', p_agreement_id;
  END IF;

  v_both := v_traveler_signed_at IS NOT NULL AND v_buddy_signed_at IS NOT NULL;

  IF v_both THEN
    v_new_status := 'fully_signed';
  ELSIF v_traveler_signed_at IS NOT NULL THEN
    v_new_status := 'signed_traveler';
  ELSE
    v_new_status := 'signed_guide';
  END IF;

  UPDATE agreements
     SET status     = v_new_status,
         updated_at = now()
   WHERE id = p_agreement_id;

  RETURN QUERY SELECT v_new_status, v_both;
END;
$$;

-- Allow the service role and authenticated role to call the RPC.
-- (The Edge function uses service role; we permit authenticated as a
-- belt-and-braces fallback in case future client paths need direct RPC use.)
GRANT EXECUTE ON FUNCTION sign_agreement_tx(uuid, text) TO authenticated, service_role;
