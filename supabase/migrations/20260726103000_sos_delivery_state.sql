-- ============================================================================
-- DURABLE SOS DELIVERY STATE + RETRIES
-- ============================================================================
-- Inserting an SOS is the safety-critical source of truth. Out-of-band paging
-- is asynchronous, so record its outcome and retry transient failures without
-- ever aborting the user's original SOS insert.
-- ============================================================================

ALTER TABLE public.sos_alerts
  ADD COLUMN IF NOT EXISTS dispatch_status text NOT NULL DEFAULT 'pending'
    CHECK (dispatch_status IN (
      'pending', 'dispatching', 'delivered', 'partial', 'failed', 'unconfigured'
    )),
  ADD COLUMN IF NOT EXISTS dispatch_attempts integer NOT NULL DEFAULT 0
    CHECK (dispatch_attempts >= 0),
  ADD COLUMN IF NOT EXISTS dispatch_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_last_error text,
  ADD COLUMN IF NOT EXISTS dispatch_channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Dispatch and resolution fields are server-owned. A participant may create
-- the emergency fact and location only; allowing whole-row INSERT would let a
-- raw client claim an alert was already resolved/delivered and suppress paging.
REVOKE INSERT, UPDATE, DELETE ON public.sos_alerts FROM anon, authenticated;
GRANT INSERT (
  booking_id,
  triggered_by,
  latitude,
  longitude
) ON public.sos_alerts TO authenticated;

CREATE INDEX IF NOT EXISTS idx_sos_alerts_dispatch_retry
  ON public.sos_alerts(dispatch_status, dispatch_last_attempt_at)
  WHERE dispatch_status <> 'delivered';

CREATE OR REPLACE FUNCTION public.enqueue_sos_alert(p_sos_alert_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_service_key  text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_supabase_url IS NULL OR v_supabase_url = ''
     OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN false;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url     := v_supabase_url || '/functions/v1/sos-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := jsonb_build_object('sos_alert_id', p_sos_alert_id)
    );
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_sos_alert failed for %: %', p_sos_alert_id, SQLERRM;
    RETURN false;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_sos_alert(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_sos_alert(uuid)
  TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.notify_sos_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_sos_alert(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_sos_alert()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_sos_alert()
  TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.retry_pending_sos_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert record;
BEGIN
  FOR v_alert IN
    SELECT id
      FROM public.sos_alerts
     WHERE status <> 'resolved'
       AND (
         (dispatch_status = 'pending'
          AND (dispatch_last_attempt_at IS NULL
               OR dispatch_last_attempt_at < now() - interval '5 minutes'))
         OR
         (dispatch_status = 'dispatching'
          AND dispatch_last_attempt_at < now() - interval '5 minutes')
         OR
         (dispatch_status IN ('failed', 'partial')
          AND dispatch_attempts < 12
          AND dispatch_last_attempt_at < now() - interval '5 minutes')
         OR
         (dispatch_status = 'unconfigured'
          AND dispatch_last_attempt_at < now() - interval '1 hour')
       )
     ORDER BY triggered_at
     LIMIT 50
  LOOP
    PERFORM public.enqueue_sos_alert(v_alert.id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_pending_sos_alerts()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_pending_sos_alerts()
  TO postgres, service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('retry_pending_sos_alerts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'retry_pending_sos_alerts',
  '*/5 * * * *',
  'SELECT public.retry_pending_sos_alerts();'
);
