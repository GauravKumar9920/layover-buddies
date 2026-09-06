-- Correlate Vercel deployment webhooks back to the Sanity publish that caused
-- them.
--
-- `content-deployment-webhook` relays a publish to a Vercel deploy hook and
-- records `building`, but the deploy-hook response only returns a *job* id,
-- while Vercel's deployment webhook reports a *deployment* id. The two are not
-- the same value, so a completion event usually arrives with an identifier we
-- have never seen. This resolver claims the pending publish that the event must
-- belong to and stamps the deployment id onto it, so every later event for the
-- same build correlates directly.

CREATE INDEX IF NOT EXISTS idx_content_deployments_provider
  ON public.content_deployments (provider_deployment_id)
  WHERE provider_deployment_id IS NOT NULL;

-- Supports the pending-claim scan below.
CREATE INDEX IF NOT EXISTS idx_content_deployments_pending
  ON public.content_deployments (requested_at DESC)
  WHERE status IN ('requested', 'building');

CREATE OR REPLACE FUNCTION public.resolve_content_deployment_for_vercel(
  p_provider_deployment_id text,
  p_window interval DEFAULT interval '30 minutes'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.content_deployments%ROWTYPE;
BEGIN
  IF p_provider_deployment_id IS NULL
     OR length(p_provider_deployment_id) = 0
     OR length(p_provider_deployment_id) > 200 THEN
    RAISE EXCEPTION 'invalid_provider_deployment_id';
  END IF;
  -- A caller-supplied window must never widen far enough to claim an unrelated
  -- historical publish.
  IF p_window IS NULL OR p_window <= interval '0' OR p_window > interval '6 hours' THEN
    RAISE EXCEPTION 'invalid_correlation_window';
  END IF;

  -- Already correlated: every event after the first takes this path.
  SELECT * INTO v_row
    FROM public.content_deployments
   WHERE provider_deployment_id = p_provider_deployment_id
   ORDER BY requested_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    -- First event for this build. Claim the oldest still-pending publish so
    -- that concurrent publishes are matched in the order they were relayed.
    -- SKIP LOCKED keeps two simultaneous deliveries from claiming one row.
    SELECT * INTO v_row
      FROM public.content_deployments
     WHERE status IN ('requested', 'building')
       AND provider_deployment_id IS NULL
       AND requested_at > now() - p_window
     ORDER BY requested_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('found', false);
    END IF;

    UPDATE public.content_deployments
       SET provider_deployment_id = p_provider_deployment_id,
           updated_at = now()
     WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'deployment_id', v_row.id,
    'sanity_document_id', v_row.sanity_document_id,
    'sanity_document_type', v_row.sanity_document_type,
    'sanity_version', v_row.sanity_version,
    'status', v_row.status::text
  );
END;
$$;

COMMENT ON FUNCTION public.resolve_content_deployment_for_vercel(text, interval) IS
  'Maps a Vercel deployment id to the pending Sanity publish it belongs to, claiming the deployment id on first sight.';

REVOKE ALL ON FUNCTION public.resolve_content_deployment_for_vercel(text, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_content_deployment_for_vercel(text, interval) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_content_deployment_for_vercel(text, interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_content_deployment_for_vercel(text, interval) TO service_role;
