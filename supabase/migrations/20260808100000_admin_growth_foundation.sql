-- ============================================================================
-- DETOUR ADMIN 2.0 — secure admin, growth, lead, and content foundations
-- ============================================================================
-- Security model:
--   * Browser clients authenticate with Supabase Auth's anon key.
--   * Active membership + an aal2 JWT is required for privileged operations.
--   * Edge Functions perform allowlisted reads with the service role only after
--     authenticating and authorizing the caller.
--   * Client roles receive no direct write grants on the tables below.
--   * admin_action_log is append-only, including for privileged DB roles.
--
-- This migration intentionally does not change guide approval. Detour's
-- existing guide auto-approval/profile-publishing behavior remains intact.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM ('owner', 'operations', 'finance', 'growth');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.marketing_lead_status AS ENUM
    ('new', 'contacted', 'qualified', 'converted', 'closed', 'spam');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.content_deployment_status AS ENUM
    ('requested', 'building', 'ready', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Team membership ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_memberships (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          public.admin_role NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  invited_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_memberships IS
  'Server-managed Detour Admin membership. Authentication remains in auth.users; role and active state live here.';
COMMENT ON COLUMN public.admin_memberships.role IS
  'owner: all capabilities; operations: marketplace and safety; finance: money; growth: analytics and content.';

CREATE INDEX IF NOT EXISTS idx_admin_memberships_active_role
  ON public.admin_memberships (role, user_id) WHERE is_active;

-- ── Immutable audit trail ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_action_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role         public.admin_role NOT NULL,
  action             text NOT NULL CHECK (length(action) BETWEEN 3 AND 120),
  target_type        text NOT NULL CHECK (length(target_type) BETWEEN 1 AND 80),
  target_id          text,
  reason             text CHECK (reason IS NULL OR length(reason) <= 2000),
  before_state       jsonb,
  after_state        jsonb,
  idempotency_key    text CHECK (
    idempotency_key IS NULL OR length(idempotency_key) BETWEEN 8 AND 128
  ),
  request_id         text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_action_log IS
  'Append-only record of privileged writes and sensitive reads. UPDATE and DELETE are rejected by trigger.';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_admin_action_idempotency
  ON public.admin_action_log (actor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_action_log_created
  ON public.admin_action_log (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_target
  ON public.admin_action_log (target_type, target_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_admin_action_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'admin_action_log_is_append_only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_action_log_append_only ON public.admin_action_log;
CREATE TRIGGER trg_admin_action_log_append_only
  BEFORE UPDATE OR DELETE ON public.admin_action_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_action_log_mutation();

-- ── Website leads ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type             text NOT NULL CHECK (request_type IN ('detour', 'cheat_sheet')),
  status                   public.marketing_lead_status NOT NULL DEFAULT 'new',
  name                     text CHECK (name IS NULL OR length(name) <= 120),
  email                    text CHECK (email IS NULL OR length(email) <= 320),
  arrival                  text CHECK (arrival IS NULL OR length(arrival) <= 120),
  departure                text CHECK (departure IS NULL OR length(departure) <= 120),
  flight_numbers           text CHECK (flight_numbers IS NULL OR length(flight_numbers) <= 120),
  interests                text CHECK (interests IS NULL OR length(interests) <= 2000),
  landing_page             text NOT NULL CHECK (length(landing_page) <= 2048),
  first_attribution        jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_attribution         jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_admin_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  linked_booking_id        uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  submission_fingerprint   text,
  rate_limit_key_hash      text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  first_contacted_at       timestamptz,
  qualified_at             timestamptz,
  converted_at             timestamptz,
  closed_at                timestamptz,
  pii_redact_after         timestamptz,
  pii_redacted_at          timestamptz,
  CONSTRAINT marketing_lead_required_fields CHECK (
    pii_redacted_at IS NOT NULL
    OR (
      email IS NOT NULL
      AND (
        request_type = 'cheat_sheet'
        OR (name IS NOT NULL AND arrival IS NOT NULL AND departure IS NOT NULL)
      )
    )
  )
);

COMMENT ON TABLE public.marketing_leads IS
  'First-party website requests. PII and row-level attribution are redacted 30 days after closure; only anonymous aggregate attribution remains.';
COMMENT ON COLUMN public.marketing_leads.submission_fingerprint IS
  'Server-generated HMAC-SHA256 idempotency fingerprint. Cleared during PII redaction and never returned to clients.';
COMMENT ON COLUMN public.marketing_leads.rate_limit_key_hash IS
  'HMAC-SHA256 abuse key. Raw client IPs are never stored; the key is cleared during PII redaction.';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_marketing_leads_submission_fingerprint
  ON public.marketing_leads (submission_fingerprint)
  WHERE submission_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_leads_queue
  ON public.marketing_leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_owner_queue
  ON public.marketing_leads (owner_admin_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_conversion
  ON public.marketing_leads (converted_at DESC) WHERE converted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_leads_redaction_due
  ON public.marketing_leads (pii_redact_after)
  WHERE pii_redact_after IS NOT NULL AND pii_redacted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.marketing_attribution_daily (
  metric_date       date NOT NULL,
  source            text NOT NULL,
  medium            text NOT NULL,
  campaign          text NOT NULL,
  landing_page      text NOT NULL,
  leads             bigint NOT NULL DEFAULT 0 CHECK (leads >= 0),
  qualified_leads   bigint NOT NULL DEFAULT 0 CHECK (qualified_leads >= 0),
  linked_bookings   bigint NOT NULL DEFAULT 0 CHECK (linked_bookings >= 0),
  completed_trips   bigint NOT NULL DEFAULT 0 CHECK (completed_trips >= 0),
  archived_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_date, source, medium, campaign, landing_page)
);

COMMENT ON TABLE public.marketing_attribution_daily IS
  'Anonymous source-to-trip aggregates retained when individual lead attribution is redacted.';

-- A small rolling counter gives the public lead endpoint atomic, server-side
-- rate limiting without retaining raw IP addresses.
CREATE TABLE IF NOT EXISTS public.marketing_lead_rate_limits (
  key_hash           text PRIMARY KEY,
  window_started_at  timestamptz NOT NULL,
  request_count      integer NOT NULL CHECK (request_count >= 0),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketing_lead_rate_limits IS
  'Short-lived hashed abuse counters for submit-marketing-lead. Rows older than 48 hours are pruned.';

-- ── Search and analytics cache ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.search_console_daily (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metric_date    date NOT NULL,
  site_url       text NOT NULL,
  search_type    text NOT NULL DEFAULT 'web',
  query          text NOT NULL DEFAULT '',
  page           text NOT NULL DEFAULT '',
  device         text NOT NULL DEFAULT '',
  country        text NOT NULL DEFAULT '',
  clicks         bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  impressions    bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  ctr            numeric(12,8) NOT NULL DEFAULT 0 CHECK (ctr >= 0 AND ctr <= 1),
  position       numeric(12,4) NOT NULL DEFAULT 0 CHECK (position >= 0),
  synced_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_date, site_url, search_type, query, page, device, country)
);

COMMENT ON TABLE public.search_console_daily IS
  'Daily directional Search Console rows. Detailed query rows are not a complete keyword ledger.';

CREATE INDEX IF NOT EXISTS idx_search_console_daily_date
  ON public.search_console_daily (metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_search_console_daily_page
  ON public.search_console_daily (page, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_search_console_daily_query
  ON public.search_console_daily (query, metric_date DESC);

CREATE TABLE IF NOT EXISTS public.growth_report_cache (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name    text NOT NULL CHECK (
    report_name IN ('overview', 'acquisition', 'content', 'search', 'health')
  ),
  provider       text NOT NULL CHECK (provider IN ('ga4', 'search_console', 'detour')),
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  payload        jsonb NOT NULL,
  warnings       text[] NOT NULL DEFAULT '{}',
  generated_at   timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  CHECK (end_date >= start_date),
  UNIQUE (report_name, provider, start_date, end_date)
);

COMMENT ON TABLE public.growth_report_cache IS
  'Normalized fixed-report responses only. Arbitrary GA/GSC queries are intentionally unsupported.';

CREATE INDEX IF NOT EXISTS idx_growth_report_cache_lookup
  ON public.growth_report_cache (report_name, start_date, end_date, expires_at DESC);

-- ── Content publishing state ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_deployments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sanity_document_id    text NOT NULL CHECK (length(sanity_document_id) <= 256),
  sanity_document_type  text,
  sanity_version        text,
  status                public.content_deployment_status NOT NULL DEFAULT 'requested',
  requested_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  preview_url           text,
  deployment_url        text,
  provider_deployment_id text,
  error_message         text CHECK (error_message IS NULL OR length(error_message) <= 4000),
  requested_at          timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz,
  completed_at          timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.content_deployments IS
  'Sanity publish to Vercel deployment status. Admin links to Studio; it is not a custom visual page builder.';

CREATE INDEX IF NOT EXISTS idx_content_deployments_status
  ON public.content_deployments (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_deployments_document
  ON public.content_deployments (sanity_document_id, requested_at DESC);

-- A realtime-safe outbox intentionally contains no coordinates, names,
-- contact details, notes, or other safety PII. Authorized ops clients listen
-- for the signal and refresh through the audited `sos.list` admin operation.
CREATE TABLE IF NOT EXISTS public.admin_realtime_signals (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic       text NOT NULL CHECK (topic IN ('sos')),
  entity_id   uuid NOT NULL,
  event_type  text NOT NULL CHECK (event_type IN ('created', 'status_changed')),
  safe_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_realtime_signals IS
  'Non-PII realtime invalidation signals. Clients must refresh sensitive records through audited admin-api operations.';

CREATE INDEX IF NOT EXISTS idx_admin_realtime_signals_topic_created
  ON public.admin_realtime_signals (topic, created_at DESC);

CREATE OR REPLACE FUNCTION public.emit_sos_admin_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_realtime_signals (topic, entity_id, event_type, safe_payload)
    VALUES ('sos', NEW.id, 'created', jsonb_build_object(
      'status', NEW.status::text,
      'triggered_at', NEW.triggered_at
    ));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_realtime_signals (topic, entity_id, event_type, safe_payload)
    VALUES ('sos', NEW.id, 'status_changed', jsonb_build_object('status', NEW.status::text));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_sos_admin_signal ON public.sos_alerts;
CREATE TRIGGER trg_emit_sos_admin_signal
  AFTER INSERT OR UPDATE OF status ON public.sos_alerts
  FOR EACH ROW EXECUTE FUNCTION public.emit_sos_admin_signal();

-- Persist the exact ready website deployment that justified the currently
-- effective public pricing. The command migration verifies its snapshot.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS pricing_content_deployment_id uuid
    REFERENCES public.content_deployments(id) ON DELETE RESTRICT;

-- ── Admin authorization helpers ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_active_admin(
  p_roles public.admin_role[] DEFAULT NULL,
  p_require_mfa boolean DEFAULT true
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.admin_memberships AS am
     WHERE am.user_id = auth.uid()
       AND am.is_active
       AND (p_roles IS NULL OR am.role = ANY (p_roles))
       AND (
         NOT p_require_mfa
         OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
       )
  );
$$;

COMMENT ON FUNCTION public.is_active_admin(public.admin_role[], boolean) IS
  'RLS helper. Privileged data requires an active membership and, by default, an aal2 JWT.';

-- A ban must stop an already-issued access token immediately, not merely block
-- its next refresh. Restrictive policies compose with every existing
-- permissive end-user policy and fail closed for banned/deleting accounts.
CREATE OR REPLACE FUNCTION public.current_account_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.users AS u
     WHERE u.id = auth.uid()
       AND COALESCE(u.is_banned, false) = false
       AND u.deletion_pending_at IS NULL
       AND u.deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.current_account_is_active() IS
  'Dynamic RLS suspension/deletion gate; invalidates data access even for an otherwise unexpired JWT.';

DO $$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT c.relname
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS account_must_be_active ON public.%I', v_table.relname);
    EXECUTE format(
      'CREATE POLICY account_must_be_active ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.current_account_is_active()) WITH CHECK (public.current_account_is_active())',
      v_table.relname
    );
  END LOOP;
END;
$$;

-- ── Lead retention/rate-limit helpers ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_marketing_lead_lifecycle_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'contacted' AND NEW.first_contacted_at IS NULL THEN
    NEW.first_contacted_at := now();
  END IF;
  IF NEW.status = 'qualified' AND NEW.qualified_at IS NULL THEN
    NEW.qualified_at := now();
  END IF;
  IF NEW.status = 'converted' AND NEW.converted_at IS NULL THEN
    NEW.converted_at := now();
  END IF;

  -- Conversion is not closure: future-trip contact/flight details remain
  -- necessary until the linked trip ends. Only explicit closed/spam states
  -- start the 30-day clock here; a cron helper below handles linked terminal
  -- bookings without changing the lead's conversion status.
  IF NEW.status IN ('closed', 'spam') AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
    NEW.pii_redact_after := now() + interval '30 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketing_lead_lifecycle ON public.marketing_leads;
CREATE TRIGGER trg_marketing_lead_lifecycle
  BEFORE INSERT OR UPDATE ON public.marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_marketing_lead_lifecycle_timestamps();

CREATE OR REPLACE FUNCTION public.consume_marketing_lead_rate_limit(
  p_key_hash text,
  p_window_seconds integer DEFAULT 3600,
  p_max_requests integer DEFAULT 8
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.marketing_lead_rate_limits%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) <> 64 THEN
    RAISE EXCEPTION 'invalid_rate_limit_key';
  END IF;
  IF p_window_seconds < 60 OR p_window_seconds > 86400
     OR p_max_requests < 1 OR p_max_requests > 100 THEN
    RAISE EXCEPTION 'invalid_rate_limit_configuration';
  END IF;

  INSERT INTO public.marketing_lead_rate_limits
    (key_hash, window_started_at, request_count, updated_at)
  VALUES (p_key_hash, v_now, 1, v_now)
  ON CONFLICT (key_hash) DO UPDATE
    SET window_started_at = CASE
          WHEN public.marketing_lead_rate_limits.window_started_at
               <= v_now - make_interval(secs => p_window_seconds)
            THEN v_now
          ELSE public.marketing_lead_rate_limits.window_started_at
        END,
        request_count = CASE
          WHEN public.marketing_lead_rate_limits.window_started_at
               <= v_now - make_interval(secs => p_window_seconds)
            THEN 1
          ELSE public.marketing_lead_rate_limits.request_count + 1
        END,
        updated_at = v_now
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'allowed', v_row.request_count <= p_max_requests,
    'remaining', GREATEST(p_max_requests - v_row.request_count, 0),
    'retry_after_seconds', CASE
      WHEN v_row.request_count <= p_max_requests THEN 0
      ELSE GREATEST(
        CEIL(EXTRACT(EPOCH FROM (
          v_row.window_started_at + make_interval(secs => p_window_seconds) - v_now
        )))::integer,
        1
      )
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_expired_marketing_leads(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_limit < 1 OR p_limit > 5000 THEN
    RAISE EXCEPTION 'invalid_limit';
  END IF;

  -- Preserve only anonymous source-to-trip aggregates before clearing every
  -- row-level attribution field. This and the redaction below share one
  -- transaction, so a failed call cannot double-count a lead on retry.
  WITH due AS (
    SELECT ml.id, ml.created_at::date AS metric_date,
           COALESCE(NULLIF(ml.last_attribution->>'utm_source', ''), NULLIF(ml.first_attribution->>'utm_source', ''),
                    NULLIF(ml.first_attribution->>'attribution_first_source', ''), '(direct)') AS source,
           COALESCE(NULLIF(ml.last_attribution->>'utm_medium', ''), NULLIF(ml.first_attribution->>'utm_medium', ''), '(none)') AS medium,
           COALESCE(NULLIF(ml.last_attribution->>'utm_campaign', ''), NULLIF(ml.first_attribution->>'utm_campaign', ''), '(not set)') AS campaign,
           ml.landing_page,
           (ml.status IN ('qualified', 'converted'))::integer AS qualified,
           (ml.linked_booking_id IS NOT NULL)::integer AS booked,
           COALESCE((b.status::text IN ('completed', 'rated'))::integer, 0) AS completed
      FROM public.marketing_leads AS ml
      LEFT JOIN public.bookings AS b ON b.id = ml.linked_booking_id
     WHERE ml.pii_redact_after <= now()
       AND ml.pii_redacted_at IS NULL
     ORDER BY ml.pii_redact_after
     LIMIT p_limit
     FOR UPDATE OF ml SKIP LOCKED
  )
  INSERT INTO public.marketing_attribution_daily
    (metric_date, source, medium, campaign, landing_page, leads,
     qualified_leads, linked_bookings, completed_trips, archived_at)
  SELECT metric_date, source, medium, campaign, landing_page,
         count(*), sum(qualified), sum(booked), sum(completed), now()
    FROM due
   GROUP BY metric_date, source, medium, campaign, landing_page
  ON CONFLICT (metric_date, source, medium, campaign, landing_page) DO UPDATE
    SET leads = public.marketing_attribution_daily.leads + EXCLUDED.leads,
        qualified_leads = public.marketing_attribution_daily.qualified_leads + EXCLUDED.qualified_leads,
        linked_bookings = public.marketing_attribution_daily.linked_bookings + EXCLUDED.linked_bookings,
        completed_trips = public.marketing_attribution_daily.completed_trips + EXCLUDED.completed_trips,
        archived_at = now();

  WITH due AS (
    SELECT id
      FROM public.marketing_leads
     WHERE pii_redact_after <= now()
       AND pii_redacted_at IS NULL
     ORDER BY pii_redact_after
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.marketing_leads AS ml
     SET name = NULL,
         email = NULL,
         arrival = NULL,
         departure = NULL,
         flight_numbers = NULL,
         interests = NULL,
         first_attribution = '{}'::jsonb,
         last_attribution = '{}'::jsonb,
         metadata = '{}'::jsonb,
         submission_fingerprint = NULL,
         rate_limit_key_hash = NULL,
         pii_redacted_at = now(),
         updated_at = now()
    FROM due
   WHERE ml.id = due.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_completed_lead_redaction(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_limit < 1 OR p_limit > 5000 THEN RAISE EXCEPTION 'invalid_limit'; END IF;

  WITH terminal AS (
    SELECT ml.id,
           COALESCE(b.completed_at, b.cancelled_at, b.updated_at) AS terminal_at
      FROM public.marketing_leads AS ml
      JOIN public.bookings AS b ON b.id = ml.linked_booking_id
     WHERE ml.status = 'converted'
       AND ml.closed_at IS NULL
       AND b.status::text IN (
         'completed', 'rated', 'cancelled', 'cancelled_no_pay',
         'cancelled_traveler_voluntary', 'cancelled_buddy',
         'cancelled_force_majeure', 'cancelled_pre_signing',
         'cancelled_no_deposit'
       )
     ORDER BY COALESCE(b.completed_at, b.cancelled_at, b.updated_at)
     LIMIT p_limit
     FOR UPDATE OF ml SKIP LOCKED
  )
  UPDATE public.marketing_leads AS ml
     SET closed_at = terminal.terminal_at,
         pii_redact_after = terminal.terminal_at + interval '30 days',
         updated_at = now()
    FROM terminal
   WHERE ml.id = terminal.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_marketing_lead_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.marketing_lead_rate_limits
   WHERE updated_at < now() - interval '48 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_admin2_lead_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scheduled integer;
  v_redacted integer;
BEGIN
  v_scheduled := public.schedule_completed_lead_redaction(500);
  v_redacted := public.redact_expired_marketing_leads(500);
  RETURN jsonb_build_object('scheduled', v_scheduled, 'redacted', v_redacted);
END;
$$;

-- ── RLS, privileges, and realtime ──────────────────────────────────────────

ALTER TABLE public.admin_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_attribution_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_lead_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_console_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_report_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_realtime_signals ENABLE ROW LEVEL SECURITY;

-- The Admin SPA reads through allowlisted Edge Functions. No anon/authenticated
-- table grants are required, which keeps raw PII and financial joins off the
-- browser's PostgREST surface even if an RLS policy is accidentally widened.
REVOKE ALL ON public.admin_memberships FROM anon, authenticated;
REVOKE ALL ON public.admin_action_log FROM anon, authenticated;
REVOKE ALL ON public.marketing_leads FROM anon, authenticated;
REVOKE ALL ON public.marketing_attribution_daily FROM anon, authenticated;
REVOKE ALL ON public.marketing_lead_rate_limits FROM anon, authenticated;
REVOKE ALL ON public.search_console_daily FROM anon, authenticated;
REVOKE ALL ON public.growth_report_cache FROM anon, authenticated;
REVOKE ALL ON public.content_deployments FROM anon, authenticated;
REVOKE ALL ON public.admin_realtime_signals FROM anon;
REVOKE ALL ON public.admin_realtime_signals FROM authenticated;

GRANT ALL ON public.admin_memberships TO service_role;
GRANT SELECT, INSERT ON public.admin_action_log TO service_role;
GRANT ALL ON public.marketing_leads TO service_role;
GRANT ALL ON public.marketing_attribution_daily TO service_role;
GRANT ALL ON public.marketing_lead_rate_limits TO service_role;
GRANT ALL ON public.search_console_daily TO service_role;
GRANT ALL ON public.growth_report_cache TO service_role;
GRANT ALL ON public.content_deployments TO service_role;
GRANT ALL ON public.admin_realtime_signals TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.search_console_daily_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_realtime_signals_id_seq TO service_role;

-- The sole direct browser read in Admin 2.0 is this non-PII invalidation
-- stream. RLS still requires active ops/owner membership and aal2.
CREATE POLICY admin_realtime_signals_ops_read
  ON public.admin_realtime_signals
  FOR SELECT TO authenticated
  USING (public.is_active_admin(ARRAY['owner', 'operations']::public.admin_role[], true));
GRANT SELECT ON public.admin_realtime_signals TO authenticated;

REVOKE ALL ON FUNCTION public.is_active_admin(public.admin_role[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin(public.admin_role[], boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.current_account_is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_account_is_active() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.consume_marketing_lead_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_marketing_lead_rate_limit(text, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.redact_expired_marketing_leads(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redact_expired_marketing_leads(integer) TO postgres, service_role;
REVOKE ALL ON FUNCTION public.schedule_completed_lead_redaction(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_completed_lead_redaction(integer) TO postgres, service_role;
REVOKE ALL ON FUNCTION public.prune_marketing_lead_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_marketing_lead_rate_limits() TO postgres, service_role;
REVOKE ALL ON FUNCTION public.run_admin2_lead_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_admin2_lead_maintenance() TO postgres, service_role;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.content_deployments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_realtime_signals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Local/hosted pg_cron maintenance. PII redaction runs hourly; rate-limit
-- counters are short-lived and pruned daily. Both helpers are idempotent.
DO $$ BEGIN
  PERFORM cron.unschedule('admin2_redact_marketing_leads');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'admin2_redact_marketing_leads',
  '17 * * * *',
  'SELECT public.run_admin2_lead_maintenance();'
);

DO $$ BEGIN
  PERFORM cron.unschedule('admin2_prune_lead_rate_limits');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'admin2_prune_lead_rate_limits',
  '42 3 * * *',
  'SELECT public.prune_marketing_lead_rate_limits();'
);

DO $$ BEGIN
  PERFORM cron.unschedule('admin2_prune_realtime_signals');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'admin2_prune_realtime_signals',
  '12 4 * * *',
  $$DELETE FROM public.admin_realtime_signals WHERE created_at < now() - interval '7 days';$$
);
