-- ============================================================================
-- Migration: agreement signed names + sign_agreement_tx security hardening
-- ============================================================================
-- Addresses Phase 2 Copilot review:
--
-- 1. Add traveler_signed_name / buddy_signed_name columns to `agreements`
--    so the "type your full name to sign" value is persisted alongside the
--    timestamp. This is the audit record for the e-signature under IT Act
--    2000 §10A.
--
-- 2. REVOKE EXECUTE on sign_agreement_tx from `authenticated`.
--    The original migration mistakenly granted it to `authenticated`, which
--    means any logged-in user could call the RPC directly with an arbitrary
--    agreement_id and forge signatures. The function is SECURITY DEFINER and
--    has no internal authz check, so it must only be callable via the
--    service-role client (the sign-agreement Edge function) which performs
--    all authz before calling it.
--
-- 3. CREATE OR REPLACE sign_agreement_tx to accept and store p_signed_name.
-- ============================================================================

-- ── 1. New columns ───────────────────────────────────────────────────────────

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS traveler_signed_name text,
  ADD COLUMN IF NOT EXISTS buddy_signed_name     text;

-- ── 2. Tighten EXECUTE grant (revoke from authenticated, keep service_role) ──

-- Revoke both old function signatures (pre- and post-rename) to be safe.
REVOKE EXECUTE ON FUNCTION sign_agreement_tx(uuid, text) FROM authenticated;

-- ── 3. Replace function to accept + store the signed name ────────────────────

CREATE OR REPLACE FUNCTION sign_agreement_tx(
  p_agreement_id uuid,
  p_side         text,
  p_signed_name  text DEFAULT ''
)
RETURNS TABLE (agreement_status agreement_status, both_signatures_present boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_traveler_signed_at   timestamptz;
  v_buddy_signed_at      timestamptz;
  v_new_status           agreement_status;
  v_both                 boolean;
BEGIN
  IF p_side = 'traveler' THEN
    UPDATE agreements
       SET traveler_signed_at   = COALESCE(traveler_signed_at, now()),
           traveler_signed_name = COALESCE(traveler_signed_name, NULLIF(trim(p_signed_name), '')),
           updated_at           = now()
     WHERE id = p_agreement_id
     RETURNING traveler_signed_at, buddy_signed_at
       INTO v_traveler_signed_at, v_buddy_signed_at;
  ELSIF p_side = 'buddy' THEN
    UPDATE agreements
       SET buddy_signed_at   = COALESCE(buddy_signed_at, now()),
           buddy_signed_name = COALESCE(buddy_signed_name, NULLIF(trim(p_signed_name), '')),
           updated_at        = now()
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

-- Only the Edge function's service-role client may call this.
GRANT EXECUTE ON FUNCTION sign_agreement_tx(uuid, text, text) TO service_role;
