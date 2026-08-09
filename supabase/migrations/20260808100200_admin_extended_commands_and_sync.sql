-- ============================================================================
-- DETOUR ADMIN 2.0 — disputes, money dispatch, content events, daily GSC sync
-- ============================================================================

-- ── Dispute resolution ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_booking_id uuid,
  p_resolution text,
  p_reason text,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before public.bookings%ROWTYPE;
  v_after public.bookings%ROWTYPE;
  v_prior jsonb;
  v_domain_result jsonb;
  v_audit_id uuid;
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner', 'operations']::public.admin_role[]
  );
  PERFORM public.validate_admin_command_fields(p_reason, p_idempotency_key);

  SELECT * INTO v_before FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;

  v_prior := public.admin_idempotent_result(
    p_actor_id, 'disputes.resolve', 'booking', p_booking_id::text, p_idempotency_key
  );
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  IF v_before.status::text <> 'disputed' THEN
    RAISE EXCEPTION 'booking_not_disputed';
  END IF;
  IF p_resolution = 'resume_reconciliation' THEN
    UPDATE public.bookings
       SET status = 'reconciling'
     WHERE id = p_booking_id AND status = 'disputed';
    v_domain_result := jsonb_build_object('resolution', p_resolution);
  ELSIF p_resolution = 'cancel_force_majeure' THEN
    v_domain_result := public.compute_cancellation_resolution_tx(
      p_booking_id, 'force_majeure_verified', 'platform'
    );
  ELSE
    RAISE EXCEPTION 'invalid_dispute_resolution';
  END IF;

  SELECT * INTO v_after FROM public.bookings WHERE id = p_booking_id;

  INSERT INTO public.admin_action_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     before_state, after_state, idempotency_key, request_id, metadata)
  VALUES
    (p_actor_id, p_actor_role, 'disputes.resolve', 'booking', p_booking_id::text,
     btrim(p_reason),
     jsonb_build_object(
       'id', v_before.id, 'status', v_before.status::text,
       'payment_status', v_before.payment_status::text,
       'reconciled_at', v_before.reconciled_at
     ),
     jsonb_build_object(
       'id', v_after.id, 'status', v_after.status::text,
       'payment_status', v_after.payment_status::text,
       'reconciled_at', v_after.reconciled_at,
       'cancellation_trigger_event', v_after.cancellation_trigger_event
     ),
     p_idempotency_key, p_request_id,
     jsonb_build_object('resolution', p_resolution, 'domain_result', v_domain_result))
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'idempotent', false,
    'audit_id', v_audit_id,
    'result', jsonb_build_object(
      'id', v_after.id,
      'status', v_after.status::text,
      'resolution', p_resolution,
      'domain_result', v_domain_result
    )
  );
END;
$$;

-- ── External refund/payout dispatch claims ─────────────────────────────────
-- The DB transaction authorizes and audits the request before the Edge Function
-- invokes the existing idempotent issue-refund domain function. A separate
-- outcome audit records the resulting row state. A repeated HTTP request with
-- the same idempotency key returns the original claim and does not redispatch.

CREATE OR REPLACE FUNCTION public.admin_claim_money_dispatch_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_dispatch_id uuid,
  p_family text,
  p_reason text,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dispatch public.payout_dispatches%ROWTYPE;
  v_prior jsonb;
  v_action text;
  v_audit_id uuid;
  v_refund_kinds text[] := ARRAY[
    'traveler_refund', 'traveler_deposit_refund', 'buddy_deposit_refund',
    'trip_fund_cancellation_refund', 'buddy_fee_cancellation_refund',
    'cancellation_refund', 'force_majeure_refund'
  ];
  v_payout_kinds text[] := ARRAY['buddy_fee_final', 'trip_pot_release'];
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner', 'finance']::public.admin_role[]
  );
  PERFORM public.validate_admin_command_fields(p_reason, p_idempotency_key);
  IF p_family NOT IN ('refund', 'payout') THEN RAISE EXCEPTION 'invalid_dispatch_family'; END IF;
  v_action := CASE WHEN p_family = 'refund' THEN 'refunds.issue' ELSE 'payouts.retry' END;

  SELECT * INTO v_dispatch
    FROM public.payout_dispatches WHERE id = p_dispatch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payout_dispatch_not_found'; END IF;

  v_prior := public.admin_idempotent_result(
    p_actor_id, v_action, 'payout_dispatch', p_dispatch_id::text, p_idempotency_key
  );
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  IF v_dispatch.status::text NOT IN ('pending', 'failed') THEN
    RAISE EXCEPTION 'dispatch_not_retryable';
  END IF;
  IF p_family = 'refund' AND NOT (v_dispatch.kind::text = ANY (v_refund_kinds)) THEN
    RAISE EXCEPTION 'dispatch_is_not_refund';
  END IF;
  IF p_family = 'payout' AND NOT (v_dispatch.kind::text = ANY (v_payout_kinds)) THEN
    RAISE EXCEPTION 'dispatch_is_not_payout';
  END IF;

  INSERT INTO public.admin_action_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     before_state, after_state, idempotency_key, request_id)
  VALUES
    (p_actor_id, p_actor_role, v_action, 'payout_dispatch', p_dispatch_id::text,
     btrim(p_reason),
     jsonb_build_object(
       'id', v_dispatch.id, 'booking_id', v_dispatch.booking_id,
       'kind', v_dispatch.kind::text, 'status', v_dispatch.status::text,
       'net_paise', v_dispatch.net_paise
     ),
     jsonb_build_object('dispatch_requested', true),
     p_idempotency_key, p_request_id)
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'idempotent', false,
    'audit_id', v_audit_id,
    'result', jsonb_build_object(
      'dispatch_id', v_dispatch.id,
      'family', p_family,
      'status', v_dispatch.status::text,
      'dispatch_requested', true
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_money_dispatch_outcome_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_dispatch_id uuid,
  p_family text,
  p_request_id text,
  p_claim_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dispatch public.payout_dispatches%ROWTYPE;
  v_action text;
  v_key text;
  v_id uuid;
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner', 'finance']::public.admin_role[]
  );
  v_action := CASE WHEN p_family = 'refund' THEN 'refunds.outcome' ELSE 'payouts.outcome' END;
  v_key := left(p_claim_idempotency_key, 116) || ':outcome';
  PERFORM public.validate_admin_command_fields('dispatch outcome', v_key);

  SELECT * INTO v_dispatch FROM public.payout_dispatches WHERE id = p_dispatch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'payout_dispatch_not_found'; END IF;

  BEGIN
    INSERT INTO public.admin_action_log
      (actor_id, actor_role, action, target_type, target_id, reason,
       after_state, idempotency_key, request_id)
    VALUES
      (p_actor_id, p_actor_role, v_action, 'payout_dispatch', p_dispatch_id::text,
       'dispatch outcome',
       jsonb_build_object(
         'id', v_dispatch.id, 'booking_id', v_dispatch.booking_id,
         'kind', v_dispatch.kind::text, 'status', v_dispatch.status::text,
         'net_paise', v_dispatch.net_paise,
         'completed_at', v_dispatch.completed_at,
         'has_failure', v_dispatch.failed_reason IS NOT NULL
       ),
       v_key, p_request_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.admin_action_log
     WHERE actor_id = p_actor_id AND idempotency_key = v_key;
  END;

  RETURN jsonb_build_object(
    'audit_id', v_id,
    'result', jsonb_build_object(
      'id', v_dispatch.id,
      'booking_id', v_dispatch.booking_id,
      'kind', v_dispatch.kind::text,
      'net_paise', v_dispatch.net_paise,
      'status', v_dispatch.status::text,
      'initiated_at', v_dispatch.initiated_at,
      'completed_at', v_dispatch.completed_at,
      'failed_reason', v_dispatch.failed_reason,
      'has_failure', v_dispatch.failed_reason IS NOT NULL
    )
  );
END;
$$;

-- ── Content deployment webhook transaction ─────────────────────────────────

ALTER TABLE public.content_deployments
  ADD COLUMN IF NOT EXISTS last_webhook_event_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_content_deployments_webhook_event
  ON public.content_deployments (last_webhook_event_id)
  WHERE last_webhook_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.content_deployment_events (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployment_id  uuid NOT NULL REFERENCES public.content_deployments(id) ON DELETE CASCADE,
  event_id       text NOT NULL UNIQUE,
  status         public.content_deployment_status NOT NULL,
  safe_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.content_deployment_events IS
  'Append-only, idempotent Sanity/Vercel deployment state history. Webhook secrets and raw request bodies are never stored.';

CREATE OR REPLACE FUNCTION public.prevent_content_deployment_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'content_deployment_events_are_append_only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_content_deployment_events_append_only
  ON public.content_deployment_events;
CREATE TRIGGER trg_content_deployment_events_append_only
  BEFORE UPDATE OR DELETE ON public.content_deployment_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_content_deployment_event_mutation();

ALTER TABLE public.content_deployment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_deployment_events FROM anon, authenticated;
GRANT ALL ON public.content_deployment_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.content_deployment_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_content_deployment_event_tx(
  p_event_id text,
  p_deployment_id uuid,
  p_sanity_document_id text,
  p_sanity_document_type text,
  p_sanity_version text,
  p_status text,
  p_preview_url text,
  p_deployment_url text,
  p_provider_deployment_id text,
  p_error_message text,
  p_metadata jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.content_deployments%ROWTYPE;
  v_existing_event public.content_deployment_events%ROWTYPE;
  v_next public.content_deployment_status;
BEGIN
  IF p_event_id IS NULL OR length(p_event_id) < 8 OR length(p_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_webhook_event_id';
  END IF;
  IF p_sanity_document_id IS NULL OR length(p_sanity_document_id) > 256 THEN
    RAISE EXCEPTION 'invalid_sanity_document_id';
  END IF;
  IF p_status NOT IN ('requested', 'building', 'ready', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_deployment_status';
  END IF;
  v_next := p_status::public.content_deployment_status;
  IF p_error_message IS NOT NULL AND length(p_error_message) > 4000 THEN
    RAISE EXCEPTION 'deployment_error_too_long';
  END IF;

  SELECT * INTO v_existing_event
    FROM public.content_deployment_events WHERE event_id = p_event_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'idempotent', true,
      'deployment_id', v_existing_event.deployment_id,
      'status', v_existing_event.status::text
    );
  END IF;

  IF p_deployment_id IS NULL THEN
    IF v_next <> 'requested' THEN RAISE EXCEPTION 'deployment_id_required'; END IF;
    INSERT INTO public.content_deployments
      (sanity_document_id, sanity_document_type, sanity_version, status,
       preview_url, provider_deployment_id, metadata, last_webhook_event_id)
    VALUES
      (p_sanity_document_id, p_sanity_document_type, p_sanity_version, v_next,
       p_preview_url, p_provider_deployment_id, COALESCE(p_metadata, '{}'::jsonb), p_event_id)
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row
      FROM public.content_deployments WHERE id = p_deployment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'content_deployment_not_found'; END IF;
    IF v_row.sanity_document_id <> p_sanity_document_id THEN
      RAISE EXCEPTION 'deployment_document_mismatch';
    END IF;
    IF v_row.status IN ('ready', 'failed', 'cancelled') AND v_next <> v_row.status THEN
      RAISE EXCEPTION 'deployment_already_final';
    END IF;
    IF v_row.status = 'requested' AND v_next NOT IN ('requested', 'building', 'ready', 'failed', 'cancelled') THEN
      RAISE EXCEPTION 'invalid_deployment_transition';
    END IF;
    IF v_row.status = 'building' AND v_next NOT IN ('building', 'ready', 'failed', 'cancelled') THEN
      RAISE EXCEPTION 'invalid_deployment_transition';
    END IF;

    UPDATE public.content_deployments
       SET sanity_version = COALESCE(p_sanity_version, sanity_version),
           status = v_next,
           preview_url = COALESCE(p_preview_url, preview_url),
           deployment_url = COALESCE(p_deployment_url, deployment_url),
           provider_deployment_id = COALESCE(p_provider_deployment_id, provider_deployment_id),
           error_message = CASE WHEN v_next = 'failed' THEN p_error_message ELSE NULL END,
           started_at = CASE WHEN v_next = 'building' THEN COALESCE(started_at, now()) ELSE started_at END,
           completed_at = CASE WHEN v_next IN ('ready', 'failed', 'cancelled') THEN COALESCE(completed_at, now()) ELSE completed_at END,
           updated_at = now(),
           metadata = metadata || COALESCE(p_metadata, '{}'::jsonb),
           last_webhook_event_id = p_event_id
     WHERE id = p_deployment_id
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.content_deployment_events
    (deployment_id, event_id, status, safe_payload)
  VALUES
    (v_row.id, p_event_id, v_row.status, jsonb_build_object(
      'sanity_document_id', v_row.sanity_document_id,
      'sanity_version', v_row.sanity_version,
      'provider_deployment_id', v_row.provider_deployment_id,
      'has_error', v_row.error_message IS NOT NULL
    ));

  RETURN jsonb_build_object(
    'idempotent', false,
    'deployment_id', v_row.id,
    'status', v_row.status::text
  );
END;
$$;

-- ── Daily Search Console sync schedule ─────────────────────────────────────
-- Uses a dedicated least-privilege secret. It must not reuse the Supabase
-- service-role key: this endpoint has gateway JWT verification disabled and
-- validates only SEARCH_SYNC_SECRET in constant time.

CREATE OR REPLACE FUNCTION public.cron_sync_search_console()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_sync_secret text := current_setting('app.settings.search_sync_secret', true);
BEGIN
  IF COALESCE(v_supabase_url, '') = '' OR COALESCE(v_sync_secret, '') = '' THEN
    RETURN;
  END IF;
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/sync-search-console',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_sync_secret
      ),
      body := jsonb_build_object('requestedAt', now())
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'cron_sync_search_console failed to enqueue: %', SQLERRM;
  END;
END;
$$;

DO $$ BEGIN
  PERFORM cron.unschedule('admin2_sync_search_console');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'admin2_sync_search_console',
  '30 4 * * *',
  'SELECT public.cron_sync_search_console();'
);

-- ── Privileges ──────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.admin_resolve_dispute_tx(uuid, public.admin_role, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_claim_money_dispatch_tx(uuid, public.admin_role, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_record_money_dispatch_outcome_tx(uuid, public.admin_role, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_content_deployment_event_tx(text, uuid, text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_sync_search_console() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_content_deployment_event_mutation() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute_tx(uuid, public.admin_role, uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_claim_money_dispatch_tx(uuid, public.admin_role, uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_record_money_dispatch_outcome_tx(uuid, public.admin_role, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_content_deployment_event_tx(text, uuid, text, text, text, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_sync_search_console() TO postgres, service_role;
