-- ============================================================================
-- DETOUR ADMIN 2.0 — narrow, audited command transactions
-- ============================================================================
-- Edge Functions authenticate the human administrator, then call only these
-- SECURITY DEFINER transactions with the server-side service role. Every
-- function re-checks active membership and role, locks its target row, validates
-- the transition, and appends its audit record in the same transaction.
--
-- No function below changes guide verification or profile auto-approval.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assert_admin_actor(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_allowed_roles public.admin_role[]
) RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
      FROM public.admin_memberships AS am
     WHERE am.user_id = p_actor_id
       AND am.role = p_actor_role
       AND am.is_active
       AND am.role = ANY (p_allowed_roles)
  ) THEN
    RAISE EXCEPTION 'admin_forbidden'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_admin_command_fields(
  p_reason text,
  p_idempotency_key text
) RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 OR length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  IF p_idempotency_key IS NULL
     OR length(p_idempotency_key) < 8
     OR length(p_idempotency_key) > 128
     OR p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;
END;
$$;

-- Returns the prior command result when the caller retries the exact same
-- request. Reusing a key for a different action/target is rejected.
CREATE OR REPLACE FUNCTION public.admin_idempotent_result(
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_log public.admin_action_log%ROWTYPE;
BEGIN
  SELECT * INTO v_log
    FROM public.admin_action_log
   WHERE actor_id = p_actor_id
     AND idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_log.action <> p_action
     OR v_log.target_type <> p_target_type
     OR v_log.target_id IS DISTINCT FROM p_target_id THEN
    RAISE EXCEPTION 'idempotency_key_reused'
      USING ERRCODE = '23505';
  END IF;

  RETURN jsonb_build_object(
    'idempotent', true,
    'audit_id', v_log.id,
    'result', v_log.after_state
  );
END;
$$;

-- ── SOS lifecycle ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_transition_sos_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_sos_alert_id uuid,
  p_next_status text,
  p_reason text,
  p_resolution_notes text,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before public.sos_alerts%ROWTYPE;
  v_after public.sos_alerts%ROWTYPE;
  v_prior jsonb;
  v_audit_id uuid;
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner', 'operations']::public.admin_role[]
  );
  PERFORM public.validate_admin_command_fields(p_reason, p_idempotency_key);

  SELECT * INTO v_before
    FROM public.sos_alerts
   WHERE id = p_sos_alert_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sos_alert_not_found'; END IF;

  v_prior := public.admin_idempotent_result(
    p_actor_id, 'sos.transition', 'sos_alert', p_sos_alert_id::text, p_idempotency_key
  );
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  IF p_next_status NOT IN ('acknowledged', 'resolved') THEN
    RAISE EXCEPTION 'invalid_sos_status';
  END IF;
  IF p_next_status = 'acknowledged' AND v_before.status::text <> 'triggered' THEN
    RAISE EXCEPTION 'invalid_sos_transition:%->%', v_before.status, p_next_status;
  END IF;
  IF p_next_status = 'resolved'
     AND v_before.status::text NOT IN ('triggered', 'acknowledged') THEN
    RAISE EXCEPTION 'invalid_sos_transition:%->%', v_before.status, p_next_status;
  END IF;
  IF p_next_status = 'resolved'
     AND (p_resolution_notes IS NULL OR length(btrim(p_resolution_notes)) < 3) THEN
    RAISE EXCEPTION 'resolution_notes_required';
  END IF;
  IF p_resolution_notes IS NOT NULL AND length(p_resolution_notes) > 4000 THEN
    RAISE EXCEPTION 'resolution_notes_too_long';
  END IF;

  UPDATE public.sos_alerts
     SET status = p_next_status::public.sos_status,
         resolution_notes = CASE
           WHEN p_next_status = 'resolved' THEN btrim(p_resolution_notes)
           ELSE resolution_notes
         END,
         resolved_at = CASE WHEN p_next_status = 'resolved' THEN now() ELSE NULL END
   WHERE id = p_sos_alert_id
  RETURNING * INTO v_after;

  INSERT INTO public.admin_action_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     before_state, after_state, idempotency_key, request_id)
  VALUES
    (p_actor_id, p_actor_role, 'sos.transition', 'sos_alert', p_sos_alert_id::text,
     btrim(p_reason),
     jsonb_build_object(
       'id', v_before.id, 'status', v_before.status::text,
       'resolved_at', v_before.resolved_at, 'dispatch_status', v_before.dispatch_status
     ),
     jsonb_build_object(
       'id', v_after.id, 'status', v_after.status::text,
       'resolved_at', v_after.resolved_at, 'dispatch_status', v_after.dispatch_status
     ),
     p_idempotency_key, p_request_id)
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object('idempotent', false, 'audit_id', v_audit_id, 'result', to_jsonb(v_after));
END;
$$;

-- ── Moderation reports ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_transition_report_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_report_id uuid,
  p_next_status text,
  p_reason text,
  p_admin_notes text,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before public.reports%ROWTYPE;
  v_after public.reports%ROWTYPE;
  v_prior jsonb;
  v_audit_id uuid;
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner', 'operations']::public.admin_role[]
  );
  PERFORM public.validate_admin_command_fields(p_reason, p_idempotency_key);

  SELECT * INTO v_before FROM public.reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report_not_found'; END IF;

  v_prior := public.admin_idempotent_result(
    p_actor_id, 'reports.transition', 'report', p_report_id::text, p_idempotency_key
  );
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  IF p_next_status NOT IN ('reviewing', 'actioned', 'dismissed') THEN
    RAISE EXCEPTION 'invalid_report_status';
  END IF;
  IF v_before.status::text = 'open' AND p_next_status NOT IN ('reviewing', 'actioned', 'dismissed') THEN
    RAISE EXCEPTION 'invalid_report_transition';
  ELSIF v_before.status::text = 'reviewing' AND p_next_status NOT IN ('actioned', 'dismissed') THEN
    RAISE EXCEPTION 'invalid_report_transition';
  ELSIF v_before.status::text IN ('actioned', 'dismissed') THEN
    RAISE EXCEPTION 'report_already_final';
  END IF;
  IF p_next_status IN ('actioned', 'dismissed')
     AND (p_admin_notes IS NULL OR length(btrim(p_admin_notes)) < 3) THEN
    RAISE EXCEPTION 'admin_notes_required';
  END IF;
  IF p_admin_notes IS NOT NULL AND length(p_admin_notes) > 4000 THEN
    RAISE EXCEPTION 'admin_notes_too_long';
  END IF;

  UPDATE public.reports
     SET status = p_next_status::public.report_status,
         admin_notes = COALESCE(NULLIF(btrim(p_admin_notes), ''), admin_notes),
         reviewed_at = CASE WHEN p_next_status IN ('actioned', 'dismissed') THEN now() ELSE reviewed_at END
   WHERE id = p_report_id
  RETURNING * INTO v_after;

  INSERT INTO public.admin_action_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     before_state, after_state, idempotency_key, request_id)
  VALUES
    (p_actor_id, p_actor_role, 'reports.transition', 'report', p_report_id::text,
     btrim(p_reason),
     jsonb_build_object(
       'id', v_before.id, 'status', v_before.status::text,
       'reviewed_at', v_before.reviewed_at
     ),
     jsonb_build_object(
       'id', v_after.id, 'status', v_after.status::text,
       'reviewed_at', v_after.reviewed_at
     ),
     p_idempotency_key, p_request_id)
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object('idempotent', false, 'audit_id', v_audit_id, 'result', to_jsonb(v_after));
END;
$$;

-- ── Lead workflow ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_update_marketing_lead_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_lead_id uuid,
  p_next_status text,
  p_owner_admin_id uuid,
  p_owner_admin_id_set boolean,
  p_linked_user_id uuid,
  p_linked_user_id_set boolean,
  p_linked_booking_id uuid,
  p_linked_booking_id_set boolean,
  p_reason text,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before public.marketing_leads%ROWTYPE;
  v_after public.marketing_leads%ROWTYPE;
  v_prior jsonb;
  v_audit_id uuid;
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner', 'operations']::public.admin_role[]
  );
  PERFORM public.validate_admin_command_fields(p_reason, p_idempotency_key);

  SELECT * INTO v_before FROM public.marketing_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'marketing_lead_not_found'; END IF;

  v_prior := public.admin_idempotent_result(
    p_actor_id, 'leads.update', 'marketing_lead', p_lead_id::text, p_idempotency_key
  );
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  IF p_next_status NOT IN ('new', 'contacted', 'qualified', 'converted', 'closed', 'spam') THEN
    RAISE EXCEPTION 'invalid_lead_status';
  END IF;
  IF v_before.status::text IN ('converted', 'closed', 'spam')
     AND p_next_status <> v_before.status::text THEN
    RAISE EXCEPTION 'lead_already_final';
  END IF;
  IF v_before.status::text = 'new'
     AND p_next_status NOT IN ('new', 'contacted', 'qualified', 'closed', 'spam') THEN
    RAISE EXCEPTION 'invalid_lead_transition';
  END IF;
  IF v_before.status::text = 'contacted'
     AND p_next_status NOT IN ('contacted', 'qualified', 'converted', 'closed', 'spam') THEN
    RAISE EXCEPTION 'invalid_lead_transition';
  END IF;
  IF v_before.status::text = 'qualified'
     AND p_next_status NOT IN ('qualified', 'converted', 'closed', 'spam') THEN
    RAISE EXCEPTION 'invalid_lead_transition';
  END IF;
  IF p_owner_admin_id_set AND p_owner_admin_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.admin_memberships
     WHERE user_id = p_owner_admin_id AND is_active
  ) THEN
    RAISE EXCEPTION 'lead_owner_not_active_admin';
  END IF;
  IF p_linked_user_id_set AND p_linked_user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_linked_user_id) THEN
    RAISE EXCEPTION 'linked_user_not_found';
  END IF;
  IF p_linked_booking_id_set AND p_linked_booking_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = p_linked_booking_id) THEN
    RAISE EXCEPTION 'linked_booking_not_found';
  END IF;
  IF p_next_status = 'converted'
     AND (CASE WHEN p_linked_user_id_set THEN p_linked_user_id ELSE v_before.linked_user_id END) IS NULL
     AND (CASE WHEN p_linked_booking_id_set THEN p_linked_booking_id ELSE v_before.linked_booking_id END) IS NULL THEN
    RAISE EXCEPTION 'conversion_link_required';
  END IF;

  UPDATE public.marketing_leads
     SET status = p_next_status::public.marketing_lead_status,
         owner_admin_id = CASE WHEN p_owner_admin_id_set THEN p_owner_admin_id ELSE owner_admin_id END,
         linked_user_id = CASE WHEN p_linked_user_id_set THEN p_linked_user_id ELSE linked_user_id END,
         linked_booking_id = CASE WHEN p_linked_booking_id_set THEN p_linked_booking_id ELSE linked_booking_id END
   WHERE id = p_lead_id
  RETURNING * INTO v_after;

  INSERT INTO public.admin_action_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     before_state, after_state, idempotency_key, request_id)
  VALUES
    (p_actor_id, p_actor_role, 'leads.update', 'marketing_lead', p_lead_id::text,
     btrim(p_reason),
     jsonb_build_object(
       'id', v_before.id, 'status', v_before.status::text,
       'owner_admin_id', v_before.owner_admin_id,
       'linked_user_id', v_before.linked_user_id,
       'linked_booking_id', v_before.linked_booking_id
     ),
     jsonb_build_object(
       'id', v_after.id, 'status', v_after.status::text,
       'owner_admin_id', v_after.owner_admin_id,
       'linked_user_id', v_after.linked_user_id,
       'linked_booking_id', v_after.linked_booking_id
     ),
     p_idempotency_key, p_request_id)
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object('idempotent', false, 'audit_id', v_audit_id, 'result', to_jsonb(v_after));
END;
$$;

-- ── Account suspension (does not alter guide approval) ─────────────────────

CREATE OR REPLACE FUNCTION public.admin_set_user_suspension_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_user_id uuid,
  p_suspended boolean,
  p_reason text,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before public.users%ROWTYPE;
  v_after public.users%ROWTYPE;
  v_prior jsonb;
  v_audit_id uuid;
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner', 'operations']::public.admin_role[]
  );
  PERFORM public.validate_admin_command_fields(p_reason, p_idempotency_key);

  SELECT * INTO v_before FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.admin_memberships WHERE user_id = p_user_id AND is_active) THEN
    RAISE EXCEPTION 'cannot_suspend_admin_here';
  END IF;

  v_prior := public.admin_idempotent_result(
    p_actor_id, 'users.suspension', 'user', p_user_id::text, p_idempotency_key
  );
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  UPDATE public.users
     SET is_banned = p_suspended,
         banned_at = CASE WHEN p_suspended THEN now() ELSE NULL END,
         banned_reason = CASE WHEN p_suspended THEN btrim(p_reason) ELSE NULL END
   WHERE id = p_user_id
  RETURNING * INTO v_after;

  -- GoTrue observes banned_until on the next auth check/refresh. Revoking all
  -- stored sessions plus the restrictive public-table policies introduced in
  -- the foundation migration makes the suspension effective immediately for
  -- both refresh and already-issued access tokens.
  UPDATE auth.users
     SET banned_until = CASE WHEN p_suspended THEN now() + interval '100 years' ELSE NULL END,
         updated_at = now()
   WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'auth_user_not_found'; END IF;

  UPDATE auth.refresh_tokens
     SET revoked = true, updated_at = now()
   WHERE user_id = p_user_id::text AND NOT revoked;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;

  INSERT INTO public.admin_action_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     before_state, after_state, idempotency_key, request_id)
  VALUES
    (p_actor_id, p_actor_role, 'users.suspension', 'user', p_user_id::text,
     btrim(p_reason),
     jsonb_build_object('id', v_before.id, 'is_banned', v_before.is_banned, 'banned_at', v_before.banned_at),
     jsonb_build_object(
       'id', v_after.id, 'is_banned', v_after.is_banned,
       'banned_at', v_after.banned_at, 'banned_reason', v_after.banned_reason,
       'auth_ban_enforced', true
     ),
     p_idempotency_key, p_request_id)
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'idempotent', false,
    'audit_id', v_audit_id,
    'result', jsonb_build_object(
      'id', v_after.id,
      'is_banned', v_after.is_banned,
      'banned_at', v_after.banned_at,
      'banned_reason', v_after.banned_reason,
      'auth_ban_enforced', true
    )
  );
END;
$$;

-- ── Admin membership management ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_upsert_membership_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_user_id uuid,
  p_role text,
  p_is_active boolean,
  p_reason text,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before public.admin_memberships%ROWTYPE;
  v_after public.admin_memberships%ROWTYPE;
  v_prior jsonb;
  v_audit_id uuid;
  v_new_role public.admin_role;
  v_owner_count integer;
  v_target_existed boolean := false;
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner']::public.admin_role[]
  );
  PERFORM public.validate_admin_command_fields(p_reason, p_idempotency_key);
  IF p_role IS NULL OR p_is_active IS NULL
     OR p_role NOT IN ('owner', 'operations', 'finance', 'growth') THEN
    RAISE EXCEPTION 'invalid_admin_role';
  END IF;
  v_new_role := p_role::public.admin_role;

  -- Serialize every owner-count decision. Without this lock two concurrent
  -- demotions could both observe two owners and remove both.
  PERFORM pg_advisory_xact_lock(740843091058141);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'auth_user_not_found';
  END IF;
  SELECT * INTO v_before
    FROM public.admin_memberships WHERE user_id = p_user_id FOR UPDATE;
  v_target_existed := FOUND;

  v_prior := public.admin_idempotent_result(
    p_actor_id, 'admins.membership.update', 'admin_membership', p_user_id::text, p_idempotency_key
  );
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  IF p_user_id = p_actor_id AND (NOT p_is_active OR v_new_role <> 'owner') THEN
    RAISE EXCEPTION 'owner_cannot_demote_self';
  END IF;

  IF v_target_existed AND v_before.role = 'owner' AND (NOT p_is_active OR v_new_role <> 'owner') THEN
    SELECT count(*) INTO v_owner_count
      FROM public.admin_memberships
     WHERE role = 'owner' AND is_active;
    IF v_owner_count <= 1 THEN RAISE EXCEPTION 'last_owner_required'; END IF;
  END IF;

  INSERT INTO public.admin_memberships
    (user_id, role, is_active, invited_by, accepted_at)
  VALUES
    (p_user_id, v_new_role, p_is_active, p_actor_id, CASE WHEN p_is_active THEN now() ELSE NULL END)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        accepted_at = CASE
          WHEN EXCLUDED.is_active THEN COALESCE(public.admin_memberships.accepted_at, now())
          ELSE public.admin_memberships.accepted_at
        END,
        updated_at = now()
  RETURNING * INTO v_after;

  INSERT INTO public.admin_action_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     before_state, after_state, idempotency_key, request_id)
  VALUES
    (p_actor_id, p_actor_role, 'admins.membership.update', 'admin_membership', p_user_id::text,
     btrim(p_reason), CASE WHEN NOT v_target_existed THEN NULL ELSE jsonb_build_object(
       'user_id', v_before.user_id, 'role', v_before.role::text, 'is_active', v_before.is_active
     ) END,
     jsonb_build_object('user_id', v_after.user_id, 'role', v_after.role::text, 'is_active', v_after.is_active),
     p_idempotency_key, p_request_id)
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object('idempotent', false, 'audit_id', v_audit_id, 'result', to_jsonb(v_after));
END;
$$;

-- ── Pricing settings ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_update_platform_settings_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_early_access_mode boolean,
  p_platform_fee_up_rate numeric,
  p_platform_fee_down_rate numeric,
  p_commission_rate numeric,
  p_gst_rate numeric,
  p_tds_rate numeric,
  p_late_fee_paise integer,
  p_content_deployment_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before public.platform_settings%ROWTYPE;
  v_after public.platform_settings%ROWTYPE;
  v_prior jsonb;
  v_audit_id uuid;
  v_expected_snapshot jsonb;
  v_pricing_changed boolean;
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner', 'finance']::public.admin_role[]
  );
  PERFORM public.validate_admin_command_fields(p_reason, p_idempotency_key);

  SELECT * INTO v_before FROM public.platform_settings WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'platform_settings_missing'; END IF;

  v_prior := public.admin_idempotent_result(
    p_actor_id, 'settings.update', 'platform_settings', '1', p_idempotency_key
  );
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  IF p_platform_fee_up_rate < 0 OR p_platform_fee_up_rate > 1
     OR p_platform_fee_down_rate < 0 OR p_platform_fee_down_rate > 1
     OR p_commission_rate < 0 OR p_commission_rate > 1
     OR p_gst_rate < 0 OR p_gst_rate > 1
     OR p_tds_rate < 0 OR p_tds_rate > 1
     OR p_late_fee_paise < 0 OR p_late_fee_paise > 100000000 THEN
    RAISE EXCEPTION 'invalid_pricing_values';
  END IF;

  v_expected_snapshot := jsonb_build_object(
    'earlyAccessMode', p_early_access_mode,
    'platformFeeUpRate', p_platform_fee_up_rate,
    'platformFeeDownRate', p_platform_fee_down_rate,
    'commissionRate', p_commission_rate,
    'gstRate', p_gst_rate,
    'tdsRate', p_tds_rate,
    'lateFeePaise', p_late_fee_paise
  );
  v_pricing_changed :=
    v_before.early_access_mode IS DISTINCT FROM p_early_access_mode
    OR v_before.platform_fee_up_rate IS DISTINCT FROM p_platform_fee_up_rate
    OR v_before.platform_fee_down_rate IS DISTINCT FROM p_platform_fee_down_rate
    OR v_before.commission_rate IS DISTINCT FROM p_commission_rate
    OR v_before.gst_rate IS DISTINCT FROM p_gst_rate
    OR v_before.tds_rate IS DISTINCT FROM p_tds_rate
    OR v_before.late_fee_paise IS DISTINCT FROM p_late_fee_paise;

  -- Every public pricing change requires a ready deployment carrying the exact
  -- same canonical snapshot; an unrelated or stale ready deploy cannot be
  -- reused to justify different rates/copy.
  IF v_pricing_changed THEN
    IF p_content_deployment_id IS NULL OR NOT EXISTS (
      SELECT 1
        FROM public.content_deployments
       WHERE id = p_content_deployment_id
         AND status = 'ready'
         AND completed_at IS NOT NULL
         AND metadata -> 'pricingSnapshot' = v_expected_snapshot
    ) THEN
      RAISE EXCEPTION 'matching_ready_content_deployment_required';
    END IF;
  END IF;

  UPDATE public.platform_settings
     SET early_access_mode = p_early_access_mode,
         platform_fee_up_rate = p_platform_fee_up_rate,
         platform_fee_down_rate = p_platform_fee_down_rate,
         commission_rate = p_commission_rate,
         gst_rate = p_gst_rate,
         tds_rate = p_tds_rate,
         late_fee_paise = p_late_fee_paise,
         pricing_content_deployment_id = CASE
           WHEN v_pricing_changed THEN p_content_deployment_id
           ELSE pricing_content_deployment_id
         END,
         updated_at = now()
   WHERE id = 1
  RETURNING * INTO v_after;

  INSERT INTO public.admin_action_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     before_state, after_state, idempotency_key, request_id,
     metadata)
  VALUES
    (p_actor_id, p_actor_role, 'settings.update', 'platform_settings', '1',
     btrim(p_reason), to_jsonb(v_before), to_jsonb(v_after), p_idempotency_key,
     p_request_id, jsonb_build_object('content_deployment_id', p_content_deployment_id))
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object('idempotent', false, 'audit_id', v_audit_id, 'result', to_jsonb(v_after));
END;
$$;

-- Sensitive safety-data reads are logged even though they do not mutate the
-- domain row. The Edge Function supplies a per-request idempotency key.
CREATE OR REPLACE FUNCTION public.admin_log_sensitive_access_tx(
  p_actor_id uuid,
  p_actor_role public.admin_role,
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prior jsonb;
  v_id uuid;
BEGIN
  PERFORM public.assert_admin_actor(
    p_actor_id, p_actor_role, ARRAY['owner', 'operations']::public.admin_role[]
  );
  PERFORM public.validate_admin_command_fields(p_reason, p_idempotency_key);
  IF p_target_type NOT IN ('sos_alert', 'sos_queue', 'safety_profile') THEN
    RAISE EXCEPTION 'invalid_sensitive_target';
  END IF;

  v_prior := public.admin_idempotent_result(
    p_actor_id, 'sensitive.read', p_target_type, p_target_id, p_idempotency_key
  );
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  INSERT INTO public.admin_action_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     after_state, idempotency_key, request_id, metadata)
  VALUES
    (p_actor_id, p_actor_role, 'sensitive.read', p_target_type, p_target_id,
     btrim(p_reason), jsonb_build_object('accessed', true), p_idempotency_key,
     p_request_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('idempotent', false, 'audit_id', v_id);
END;
$$;

-- ── Execute privileges ─────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.assert_admin_actor(uuid, public.admin_role, public.admin_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_admin_command_fields(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_idempotent_result(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_transition_sos_tx(uuid, public.admin_role, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_transition_report_tx(uuid, public.admin_role, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_marketing_lead_tx(uuid, public.admin_role, uuid, text, uuid, boolean, uuid, boolean, uuid, boolean, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_suspension_tx(uuid, public.admin_role, uuid, boolean, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_membership_tx(uuid, public.admin_role, uuid, text, boolean, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_platform_settings_tx(uuid, public.admin_role, boolean, numeric, numeric, numeric, numeric, numeric, integer, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_log_sensitive_access_tx(uuid, public.admin_role, text, text, text, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assert_admin_actor(uuid, public.admin_role, public.admin_role[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_admin_command_fields(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_idempotent_result(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_transition_sos_tx(uuid, public.admin_role, uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_transition_report_tx(uuid, public.admin_role, uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_marketing_lead_tx(uuid, public.admin_role, uuid, text, uuid, boolean, uuid, boolean, uuid, boolean, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_suspension_tx(uuid, public.admin_role, uuid, boolean, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_membership_tx(uuid, public.admin_role, uuid, text, boolean, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_platform_settings_tx(uuid, public.admin_role, boolean, numeric, numeric, numeric, numeric, numeric, integer, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_log_sensitive_access_tx(uuid, public.admin_role, text, text, text, text, text, jsonb) TO service_role;
