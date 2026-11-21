-- saved_places was added after the restrictive account-policy migration ran.
CREATE POLICY account_must_be_active ON public.saved_places
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_account_is_active()))
  WITH CHECK ((SELECT public.current_account_is_active()));

-- SECURITY DEFINER runs outside the caller's RLS policies, so apply the same
-- account gate before returning any linked website requests.
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
SET search_path = ''
AS $$
  SELECT l.id, l.request_type, l.status, l.arrival, l.departure, l.created_at
    FROM public.marketing_leads AS l
   WHERE public.current_account_is_active()
     AND l.linked_user_id = auth.uid()
     AND l.pii_redacted_at IS NULL
     AND l.status <> 'spam'
   ORDER BY l.created_at DESC
   LIMIT 20;
$$;
