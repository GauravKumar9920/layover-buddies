-- Run against an isolated, migrated, seeded database.
BEGIN;

INSERT INTO public.marketing_leads (request_type, email, landing_page, linked_user_id, arrival)
VALUES
  ('cheat_sheet', 'first@example.test', '/', 'aaaaaaaa-0000-4000-a000-000000000011', 'own request'),
  ('cheat_sheet', 'second@example.test', '/', 'aaaaaaaa-0000-4000-a000-000000000012', 'other request');

INSERT INTO public.saved_places (user_id, place_slug)
VALUES ('aaaaaaaa-0000-4000-a000-000000000012', 'other-traveler-place');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-a000-000000000011', true);

INSERT INTO public.saved_places (user_id, place_slug) VALUES (auth.uid(), 'own-traveler-place');

DO $$
BEGIN
  ASSERT (SELECT array_agg(place_slug) FROM public.saved_places) = ARRAY['own-traveler-place'];
  ASSERT (SELECT array_agg(arrival) FROM public.my_website_requests()) = ARRAY['own request'];
END;
$$;

RESET ROLE;
UPDATE public.users SET is_banned = true
 WHERE id = 'aaaaaaaa-0000-4000-a000-000000000011';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.saved_places);
  ASSERT NOT EXISTS (SELECT 1 FROM public.my_website_requests());
  DELETE FROM public.saved_places WHERE place_slug = 'own-traveler-place';
  ASSERT NOT FOUND;
  BEGIN
    INSERT INTO public.saved_places (user_id, place_slug) VALUES (auth.uid(), 'banned-traveler-place');
    RAISE EXCEPTION 'expected saved place insert rejection for a banned account';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

RESET ROLE;
UPDATE public.users SET is_banned = false, deletion_pending_at = now()
 WHERE id = 'aaaaaaaa-0000-4000-a000-000000000011';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.saved_places);
  ASSERT NOT EXISTS (SELECT 1 FROM public.my_website_requests());
  RAISE NOTICE 'website account ownership, suspension and pending deletion passed';
END;
$$;

ROLLBACK;
