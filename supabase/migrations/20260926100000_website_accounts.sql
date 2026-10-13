-- ============================================================================
-- Website accounts (detourtrips.com)
-- ============================================================================
-- Travellers sign in on the website with the same Supabase Auth account as the
-- app (the existing on_auth_user_created trigger provisions public.users as a
-- traveller). The website can then:
--   * keep a list of saved place field notes (saved_places, owner-only RLS);
--   * show the website requests linked to the account (my_website_requests()).
-- Leads are linked only by submit-marketing-lead, after it verifies the caller's
-- access token. Browsers still have no direct access to marketing_leads.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_places (
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  place_slug  text NOT NULL CHECK (length(place_slug) <= 80 AND place_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_slug)
);

COMMENT ON TABLE public.saved_places IS
  'Place field notes a signed-in traveller saved on detourtrips.com. Slugs match /guides/<slug>; rows are removed when the account is deleted.';

ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_places_select_own ON public.saved_places;
CREATE POLICY saved_places_select_own ON public.saved_places
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS saved_places_insert_own ON public.saved_places;
CREATE POLICY saved_places_insert_own ON public.saved_places
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.account_is_active(auth.uid()));
DROP POLICY IF EXISTS saved_places_delete_own ON public.saved_places;
CREATE POLICY saved_places_delete_own ON public.saved_places
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.saved_places FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;

-- A generous cap keeps one account from turning the table into free storage.
CREATE OR REPLACE FUNCTION public.enforce_saved_places_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.saved_places WHERE user_id = NEW.user_id) >= 100 THEN
    RAISE EXCEPTION 'saved_places_limit' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS saved_places_cap ON public.saved_places;
CREATE TRIGGER saved_places_cap
  BEFORE INSERT ON public.saved_places
  FOR EACH ROW EXECUTE FUNCTION public.enforce_saved_places_cap();

-- Account deletion anonymises public.users rather than deleting it, so clear
-- saved places explicitly when deleted_at is first set.
CREATE OR REPLACE FUNCTION public.clear_saved_places_on_account_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.saved_places WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_clear_saved_places ON public.users;
CREATE TRIGGER users_clear_saved_places
  AFTER UPDATE OF deleted_at ON public.users
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.clear_saved_places_on_account_deletion();

REVOKE ALL ON FUNCTION public.enforce_saved_places_cap() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_saved_places_on_account_deletion() FROM PUBLIC;

-- ── Website requests linked to the signed-in account ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_marketing_leads_linked_user
  ON public.marketing_leads (linked_user_id, created_at DESC)
  WHERE linked_user_id IS NOT NULL;

-- Only the columns a traveller needs; fingerprints, rate-limit keys, owner and
-- attribution never leave the server.
CREATE OR REPLACE FUNCTION public.my_website_requests()
RETURNS TABLE (
  id uuid,
  request_type text,
  status public.marketing_lead_status,
  arrival text,
  departure text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.request_type, l.status, l.arrival, l.departure, l.created_at
    FROM public.marketing_leads l
   WHERE auth.uid() IS NOT NULL
     AND l.linked_user_id = auth.uid()
     AND l.pii_redacted_at IS NULL
     AND l.status <> 'spam'
   ORDER BY l.created_at DESC
   LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.my_website_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_website_requests() TO authenticated;
