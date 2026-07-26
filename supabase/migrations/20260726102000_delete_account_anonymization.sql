-- ============================================================================
-- ACCOUNT DELETION — DISABLE, SETTLEMENT GATE, AND ANONYMIZATION
-- ============================================================================
-- Deletion spans Storage, Postgres, and Supabase Auth, so it cannot be one
-- cross-service transaction. The durable `deletion_pending_at` gate makes the
-- workflow safely retryable:
--   1. lock the user/bookings, prove every trip and money movement is settled,
--      and disable the account;
--   2. remove Storage objects;
--   3. atomically scrub personal data;
--   4. delete Auth identity.
-- If a later step fails, the disabled user can retry only this deletion flow.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.account_is_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.users
     WHERE id = p_user_id
       AND deletion_pending_at IS NULL
       AND deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.account_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_is_active(uuid)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prepare_account_deletion_tx(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id
    INTO v_user_id
    FROM public.users
   WHERE id = p_user_id
   FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Lock every participant booking so its state cannot change while the
  -- settlement checks below run.
  PERFORM 1
    FROM public.bookings
   WHERE traveler_id = p_user_id OR guide_id = p_user_id
   FOR UPDATE;

  IF EXISTS (
    SELECT 1
      FROM public.bookings
     WHERE (traveler_id = p_user_id OR guide_id = p_user_id)
       AND status NOT IN (
         'completed',
         'rated',
         'cancelled',
         'cancelled_no_pay',
         'cancelled_traveler_voluntary',
         'cancelled_buddy',
         'cancelled_force_majeure',
         'cancelled_pre_signing',
         'cancelled_no_deposit'
       )
  ) THEN
    RAISE EXCEPTION 'active_bookings';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.deposits d
      JOIN public.bookings b ON b.id = d.booking_id
     WHERE (b.traveler_id = p_user_id OR b.guide_id = p_user_id)
       AND d.status IN ('pending', 'held')
  ) OR EXISTS (
    SELECT 1
      FROM public.payment_events pe
      JOIN public.bookings b ON b.id = pe.booking_id
     WHERE (b.traveler_id = p_user_id OR b.guide_id = p_user_id)
       AND pe.status = 'initiated'
  ) OR EXISTS (
    SELECT 1
      FROM public.payout_dispatches pd
      JOIN public.bookings b ON b.id = pd.booking_id
     WHERE (b.traveler_id = p_user_id OR b.guide_id = p_user_id)
       AND pd.status IN ('pending', 'failed')
  ) OR EXISTS (
    SELECT 1
      FROM public.top_up_requests tu
      JOIN public.bookings b ON b.id = tu.booking_id
     WHERE (b.traveler_id = p_user_id OR b.guide_id = p_user_id)
       AND tu.status IN ('pending', 'approved')
  ) OR EXISTS (
    SELECT 1
      FROM public.payouts p
     WHERE p.guide_id = p_user_id
       AND p.status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'financial_settlement_pending';
  END IF;

  UPDATE public.users
     SET deletion_pending_at = COALESCE(deletion_pending_at, now()),
         is_banned = true,
         banned_at = COALESCE(banned_at, now()),
         banned_reason = 'account_deletion'
   WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion_tx(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion_tx(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.anonymize_user_data_tx(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT *
    INTO v_user
    FROM public.users
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_user.deletion_pending_at IS NULL THEN
    RAISE EXCEPTION 'account_deletion_not_prepared';
  END IF;

  -- Re-lock participant bookings. No new booking can target this user after
  -- preparation because the booking INSERT policy checks account_is_active().
  PERFORM 1
    FROM public.bookings
   WHERE traveler_id = p_user_id OR guide_id = p_user_id
   FOR UPDATE;

  -- Public identity and payout identifiers. Keep the participant row so
  -- completed financial ledgers remain referentially valid.
  UPDATE public.users
     SET email                    = 'deleted+' || p_user_id::text || '@deleted.detourtrips.com',
         full_name                = 'Deleted account',
         phone                    = NULL,
         avatar_url               = NULL,
         payout_vpa               = NULL,
         razorpay_fund_account_id = NULL,
         is_banned                = true,
         banned_at                = COALESCE(banned_at, now()),
         banned_reason            = 'account_deleted',
         deleted_at               = COALESCE(deleted_at, now())
   WHERE id = p_user_id;

  UPDATE public.traveler_profiles
     SET nationality              = NULL,
         preferred_language       = NULL,
         emergency_contact_name   = NULL,
         emergency_contact_phone  = NULL,
         arrival_at               = NULL,
         departure_at             = NULL,
         flight_in                = NULL,
         flight_out               = NULL,
         interests                = ARRAY[]::text[],
         onboarded_at             = NULL,
         gender                   = NULL
   WHERE user_id = p_user_id;

  UPDATE public.guide_profiles
     SET is_active              = false,
         university             = 'Deleted account',
         year_of_study          = NULL,
         course                 = NULL,
         bio                    = NULL,
         video_intro_url        = NULL,
         hometown               = NULL,
         languages              = '[]'::jsonb,
         skills                 = '[]'::jsonb,
         prompts                = '[]'::jsonb,
         pull_quote             = NULL,
         gallery_urls           = ARRAY[]::text[],
         referred_by            = NULL,
         aadhaar_verified       = false,
         college_verified       = false,
         interview_passed       = false,
         police_verified        = false
   WHERE user_id = p_user_id;

  -- Authored catalogue copy is personal/public profile content. Historical
  -- titles and prices stay for booked-trip records.
  UPDATE public.itinerary_stops s
     SET description = NULL,
         image_url = NULL
    FROM public.itineraries i
   WHERE s.itinerary_id = i.id
     AND i.guide_id = p_user_id;

  UPDATE public.itineraries
     SET description     = NULL,
         is_published    = false,
         cover_image_url = NULL,
         gallery_urls    = ARRAY[]::text[],
         video_url       = NULL,
         story_blocks    = '[]'::jsonb,
         prompts         = '[]'::jsonb,
         deleted_at      = COALESCE(deleted_at, now())
   WHERE guide_id = p_user_id;

  DELETE FROM public.location_tracking WHERE user_id = p_user_id;
  DELETE FROM public.sos_alerts WHERE triggered_by = p_user_id;
  DELETE FROM public.notifications
   WHERE user_id = p_user_id OR recipient_user_id = p_user_id;
  DELETE FROM public.favorites WHERE user_id = p_user_id;
  DELETE FROM public.blocked_users
   WHERE blocker_id = p_user_id OR blocked_id = p_user_id;
  DELETE FROM public.user_push_tokens WHERE user_id = p_user_id;
  DELETE FROM public.flight_tracking ft
   USING public.bookings b
   WHERE ft.booking_id = b.id
     AND b.traveler_id = p_user_id;

  UPDATE public.messages
     SET content = '[Message removed after account deletion]'
   WHERE sender_id = p_user_id;

  -- Scrub only the deleted user's authored content. Other travelers' reviews
  -- and moderation evidence must remain intact.
  UPDATE public.reviews
     SET comment = NULL
   WHERE reviewer_id = p_user_id;

  UPDATE public.reports
     SET details = NULL
   WHERE reporter_id = p_user_id;

  UPDATE public.bookings
     SET arrival_flight_number   = NULL,
         departure_flight_number = NULL
   WHERE traveler_id = p_user_id;

  UPDATE public.agreements a
     SET traveler_signed_name = NULL
    FROM public.bookings b
   WHERE a.booking_id = b.id
     AND b.traveler_id = p_user_id;

  UPDATE public.agreements a
     SET buddy_signed_name = NULL
    FROM public.bookings b
   WHERE a.booking_id = b.id
     AND b.guide_id = p_user_id;

  UPDATE public.payouts
     SET bank_details_encrypted = NULL
   WHERE guide_id = p_user_id;

  UPDATE public.payout_dispatches
     SET razorpay_fund_account_id = NULL
   WHERE recipient_user_id = p_user_id;

  UPDATE public.guide_profiles
     SET referred_by = NULL
   WHERE referred_by = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_user_data_tx(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_user_data_tx(uuid)
  TO service_role;

-- Prevent every auth-sync entry point (sign-in, Auth trigger, or backfill)
-- from rehydrating a tombstoned profile after a failed Auth deletion.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user_sync(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  source_user auth.users%ROWTYPE;
  provider_text text;
  provider_value auth_provider;
  derived_name text;
  inferred_role user_role;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.users
     WHERE id = target_user_id
       AND deletion_pending_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO source_user
    FROM auth.users
   WHERE id = target_user_id;

  IF source_user.id IS NULL THEN
    RAISE EXCEPTION 'User % not found in auth.users', target_user_id;
  END IF;

  provider_text := COALESCE(source_user.raw_app_meta_data->>'provider', 'email');
  provider_value := CASE
    WHEN provider_text = 'google' THEN 'google'::auth_provider
    WHEN provider_text = 'apple' THEN 'apple'::auth_provider
    ELSE 'email'::auth_provider
  END;

  inferred_role := CASE
    WHEN EXISTS (
      SELECT 1
        FROM public.guide_profiles gp
       WHERE gp.user_id = source_user.id
         AND gp.is_active = true
    ) THEN 'guide'::user_role
    ELSE 'traveler'::user_role
  END;

  derived_name := COALESCE(
    NULLIF(BTRIM(source_user.raw_user_meta_data->>'full_name'), ''),
    NULLIF(SPLIT_PART(COALESCE(source_user.email, source_user.id::text), '@', 1), ''),
    'Traveler'
  );

  INSERT INTO public.users (
    id, email, full_name, role, auth_provider, is_verified
  )
  VALUES (
    source_user.id,
    COALESCE(source_user.email, source_user.id::text || '@mumbai-buddies.local'),
    derived_name,
    inferred_role,
    provider_value,
    source_user.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(public.users.full_name, ''), EXCLUDED.full_name),
        role = EXCLUDED.role,
        auth_provider = EXCLUDED.auth_provider,
        is_verified = public.users.is_verified OR EXCLUDED.is_verified,
        updated_at = now();

  IF inferred_role = 'traveler' THEN
    INSERT INTO public.traveler_profiles (user_id)
    VALUES (source_user.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user_sync(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user_sync(uuid)
  TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.sync_current_auth_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_auth_user auth.users%ROWTYPE;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.users
     WHERE id = auth.uid()
       AND deletion_pending_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'account_deletion_pending';
  END IF;

  SELECT * INTO current_auth_user
    FROM auth.users
   WHERE id = auth.uid();

  IF current_auth_user.id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found in auth.users';
  END IF;

  PERFORM public.handle_new_auth_user_sync(current_auth_user.id);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_current_auth_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_current_auth_user() TO authenticated;

REVOKE ALL ON FUNCTION public.backfill_public_users_from_auth()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_public_users_from_auth()
  TO postgres, service_role;

REVOKE ALL ON FUNCTION public.handle_new_auth_user()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user()
  TO postgres, service_role;

-- Generic write guard: even an old access JWT cannot mutate tables after the
-- durable deletion gate is set. SECURITY DEFINER RPCs retain auth.uid(), so
-- this also protects direct client calls through those functions.
CREATE OR REPLACE FUNCTION public.reject_deletion_pending_writer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.account_is_active(auth.uid()) THEN
    RAISE EXCEPTION 'account_not_active';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_deletion_pending_writer()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deletion_pending_writer()
  TO postgres, service_role;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'users',
    'traveler_profiles',
    'guide_profiles',
    'itineraries',
    'itinerary_stops',
    'bookings',
    'agreements',
    'cost_line_items',
    'favorites',
    'messages',
    'reviews',
    'location_tracking',
    'sos_alerts',
    'payouts',
    'blocked_users',
    'reports',
    'top_up_requests',
    'expense_proofs',
    'user_push_tokens'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_reject_deletion_pending_writer ON public.%I',
      v_table
    );
    EXECUTE format(
      'CREATE TRIGGER trg_reject_deletion_pending_writer
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.reject_deletion_pending_writer()',
      v_table
    );
  END LOOP;
END;
$$;

-- A traveler cannot create a new booking against a user already leaving the
-- platform. This also closes the race after prepare_account_deletion_tx locks
-- and marks the guide.
DROP POLICY IF EXISTS "Travelers can create bookings" ON public.bookings;
CREATE POLICY "Travelers can create bookings" ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'traveler'
    AND auth.uid() = traveler_id
    AND public.account_is_active(traveler_id)
    AND public.account_is_active(guide_id)
    AND EXISTS (
      SELECT 1
        FROM public.guide_profiles gp
       WHERE gp.user_id = guide_id
         AND gp.is_active = true
    )
  );
