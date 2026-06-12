-- ============================================================================
-- DROP AMBIGUOUS sign_agreement_tx OVERLOAD
-- ============================================================================
-- Two versions of sign_agreement_tx coexist:
--   sign_agreement_tx(uuid, text)            -- original (20260510100000)
--   sign_agreement_tx(uuid, text, text='')   -- signed-name version (20260510100001)
--
-- Because the 3-arg version defaults its last parameter, a 2-argument call is
-- ambiguous: PostgREST refuses RPC calls outright with PGRST203 ("could not
-- choose the best candidate function") — confirmed live in the 2026-06-11 E2E
-- run. Any caller still on the 2-arg signature is therefore already broken.
--
-- Fix: drop the old 2-arg function. The 3-arg version's DEFAULT '' keeps
-- 2-argument SQL/RPC calls working — they now resolve unambiguously.
-- ============================================================================

DROP FUNCTION IF EXISTS sign_agreement_tx(uuid, text);

-- Belt-and-braces: CREATE FUNCTION grants EXECUTE to PUBLIC by default, which
-- quietly undoes the intent of 20260510100001 ("only the Edge function's
-- service-role client may call this" — it revoked from `authenticated` but a
-- PUBLIC grant still reaches every role). Lock the surviving overload down to
-- service_role only.
REVOKE EXECUTE ON FUNCTION sign_agreement_tx(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sign_agreement_tx(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION sign_agreement_tx(uuid, text, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION sign_agreement_tx(uuid, text, text) TO service_role;
