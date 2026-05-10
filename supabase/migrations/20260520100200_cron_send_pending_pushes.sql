-- ============================================================================
-- CRON: send-pending-pushes (every 1 min)
-- ============================================================================
-- Tickles the send-push Edge function once a minute via pg_net so that any
-- notification rows written by Phase 3+4 cron jobs reach Expo Push within
-- ≤60s.  The Edge function does the heavy lifting (Expo API call, ticket
-- processing, token invalidation); this function is just a count-then-POST
-- shim that avoids waking the Edge runtime when there's nothing to send.
--
-- Configuration:
--   The supabase_url + send-push function URL come from
--   app.settings.supabase_url (set in seed.sql for local, ALTER DATABASE for
--   prod).  The bearer token is the service-role key from
--   app.settings.service_role_key (or skipped if not set, which is fine for
--   local dev when send-push is invoked directly).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION cron_send_pending_pushes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text := current_setting('app.settings.supabase_url',      true);
  v_service_key  text := current_setting('app.settings.service_role_key',  true);
  v_pending_count integer;
BEGIN
  -- Skip silently if config isn't set (e.g., fresh local DB without seed).
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN;
  END IF;
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN;
  END IF;

  -- Cheap pending-count check via the partial index — avoids waking Edge runtime
  -- when there's nothing to send.
  SELECT count(*) INTO v_pending_count
    FROM notifications
   WHERE recipient_user_id IS NOT NULL
     AND push_sent_at      IS NULL
     AND push_failed_at    IS NULL;

  IF v_pending_count = 0 THEN
    RETURN;
  END IF;

  -- Fire-and-forget POST. Edge fn drains its own queue and persists results.
  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_service_key
               ),
    body    := jsonb_build_object('limit', 100)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cron_send_pending_pushes() TO postgres, service_role;

-- Schedule every minute. Idempotent: unschedule first to avoid duplicate jobs.
DO $$ BEGIN
  PERFORM cron.unschedule('cron_send_pending_pushes');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'cron_send_pending_pushes',
  '* * * * *',
  'SELECT cron_send_pending_pushes();'
);
