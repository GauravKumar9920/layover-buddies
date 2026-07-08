-- ============================================================================
-- SOS ALERT DISPATCH — page ops the instant an SOS is filed
-- ============================================================================
-- Before this, an SOS only inserted a `sos_alerts` row whose sole consumer was
-- a never-deployed local admin console — no human was actually notified, while
-- the SafetyBar UI promised "immediately notifies the Detour ops team".
--
-- This trigger closes that gap: on every sos_alerts INSERT it fires the
-- `sos-alert` Edge function (fire-and-forget via pg_net), which delivers an
-- out-of-band alert to whatever channels the deployer has configured
-- (SOS_WEBHOOK_URL for Slack/Discord, RESEND_API_KEY + SOS_ALERT_EMAIL for
-- email). The row insert never waits on delivery.
--
-- Same config seam as cron_send_pending_pushes():
--   app.settings.supabase_url      — Edge function base URL
--   app.settings.service_role_key  — bearer for the service-role-only fn
-- If either is unset (e.g. a bare local DB) the trigger no-ops so SOS inserts
-- still succeed; delivery just doesn't fire until the settings are configured.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_sos_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text := current_setting('app.settings.supabase_url',      true);
  v_service_key  text := current_setting('app.settings.service_role_key',  true);
BEGIN
  -- No paging config → no-op (SOS row still committed). Never raise here: a
  -- delivery-config gap must not block someone filing an emergency alert.
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN NEW;
  END IF;
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget POST. The Edge fn loads trip context and delivers to ops.
  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/sos-alert',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_service_key
               ),
    body    := jsonb_build_object('sos_alert_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_sos_alert() TO postgres, service_role;

-- Idempotent: drop + recreate so re-running the migration is safe.
DROP TRIGGER IF EXISTS trg_notify_sos_alert ON sos_alerts;
CREATE TRIGGER trg_notify_sos_alert
  AFTER INSERT ON sos_alerts
  FOR EACH ROW
  EXECUTE FUNCTION notify_sos_alert();
