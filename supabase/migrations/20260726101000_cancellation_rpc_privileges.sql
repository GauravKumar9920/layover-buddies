-- ============================================================================
-- CANCELLATION RPC EXECUTE PRIVILEGES
-- ============================================================================
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. The
-- cancellation resolver is SECURITY DEFINER and can move money/state, so the
-- explicit service-role grant is not sufficient unless PUBLIC is revoked.
-- Only the cancel-booking Edge Function may call this RPC.
-- ============================================================================

REVOKE ALL
  ON FUNCTION public.compute_cancellation_resolution_tx(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.compute_cancellation_resolution_tx(uuid, text, text)
  TO service_role;
