-- ============================================================================
-- GUIDE DASHBOARD SUMMARY
-- ============================================================================
-- One private, server-side aggregate for the signed-in guide cockpit.
--
-- The dashboard deliberately reads canonical rows rather than the legacy
-- denormalized counters on guide_profiles / itineraries. It returns no booking,
-- traveler, review-comment, payment-account, or payout-provider identifiers.
-- ============================================================================

-- These partial/composite indexes match the authenticated aggregate below.
CREATE INDEX IF NOT EXISTS idx_bookings_guide_dashboard_status
  ON public.bookings (guide_id, status);

CREATE INDEX IF NOT EXISTS idx_itineraries_guide_active_published
  ON public.itineraries (guide_id)
  WHERE is_published = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_dispatches_guide_paid_earnings
  ON public.payout_dispatches (recipient_user_id, completed_at)
  WHERE kind = 'buddy_fee_final' AND status = 'sent';

DROP FUNCTION IF EXISTS public.get_my_guide_dashboard_summary();

CREATE OR REPLACE FUNCTION public.get_my_guide_dashboard_summary()
RETURNS TABLE (
  open_inquiries_count              bigint,
  upcoming_trips_count              bigint,
  completed_trips_count             bigint,
  average_rating                    numeric,
  review_count                      bigint,
  paid_earnings_paise               bigint,
  paid_earnings_current_month_paise bigint,
  active_tours_count                bigint,
  profile_completion_percent        integer,
  profile_missing_fields            text[],
  profile_status                    text,
  is_published                      boolean,
  is_active                         boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
ROWS 1
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_profile_status text := 'draft';
  v_is_active boolean := false;
  v_missing text[] := ARRAY['guide profile']::text[];
  v_completion integer := 0;
  v_month_start timestamptz :=
    date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')
      AT TIME ZONE 'Asia/Kolkata';
  v_next_month_start timestamptz :=
    (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')
      + interval '1 month') AT TIME ZONE 'Asia/Kolkata';
  v_today_start timestamptz :=
    date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
      AT TIME ZONE 'Asia/Kolkata';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Do not let a traveler, admin, deleted account, or deletion-pending account
  -- use a SECURITY DEFINER function to probe guide-side aggregates.
  IF NOT EXISTS (
    SELECT 1
      FROM public.users AS u
     WHERE u.id = v_user_id
       AND u.role = 'guide'
       AND u.deleted_at IS NULL
       AND u.deletion_pending_at IS NULL
  ) THEN
    RAISE EXCEPTION 'active_guide_account_required' USING ERRCODE = '42501';
  END IF;

  SELECT gp.id, gp.profile_status, gp.is_active
    INTO v_profile_id, v_profile_status, v_is_active
    FROM public.guide_profiles AS gp
   WHERE gp.user_id = v_user_id;

  IF v_profile_id IS NOT NULL THEN
    -- This is the same real-field validator used by publish and availability:
    -- name, avatar, university, bio, language, story answer, and cover.
    v_missing := public.guide_profile_missing_fields(v_profile_id);
    v_completion := greatest(
      0,
      least(
        100,
        round(
          ((7 - cardinality(v_missing))::numeric / 7::numeric) * 100
        )::integer
      )
    );
  END IF;

  RETURN QUERY
  WITH booking_metrics AS (
    SELECT
      count(*) FILTER (
        WHERE b.status = 'chat_open'
      ) AS open_inquiries,
      count(*) FILTER (
        WHERE
          -- "Upcoming" means a scheduled, not-yet-delivered Detour. Post-trip
          -- proof/reconciliation work stays in Needs You, while stale active
          -- rows with a past schedule do not inflate the calendar count.
          b.status IN (
            'guide_accepted',
            'confirmed',
            'agreement_drafting',
            'agreement_sent',
            'agreement_signed_traveler',
            'agreement_signed_buddy',
            'awaiting_deposits',
            'deposits_held',
            'awaiting_balance',
            'late_fee_due',
            'balance_paid',
            'trip_ready'
          )
          AND COALESCE(b.tour_start_time, b.arrival_time) >= v_today_start
      ) AS upcoming_trips,
      count(*) FILTER (
        WHERE b.status IN ('completed', 'rated')
      ) AS completed_trips
    FROM public.bookings AS b
    WHERE b.guide_id = v_user_id
  ),
  review_metrics AS (
    SELECT
      coalesce(round(avg(r.overall_rating)::numeric, 2), 0::numeric)
        AS average_rating,
      count(*) AS review_count
    FROM public.reviews AS r
    WHERE r.reviewee_id = v_user_id
  ),
  payout_metrics AS (
    SELECT
      -- gross_paise is the buddy fee after the platform fee. Subtract only
      -- tax withheld: net_paise also includes returned deposit principal and
      -- buffer settlement, neither of which is guide income.
      coalesce(
        sum(greatest(pd.gross_paise - pd.tds_paise, 0)),
        0::bigint
      ) AS paid_earnings,
      coalesce(
        sum(greatest(pd.gross_paise - pd.tds_paise, 0)) FILTER (
          WHERE pd.completed_at >= v_month_start
            AND pd.completed_at < v_next_month_start
        ),
        0::bigint
      ) AS paid_earnings_current_month
    FROM public.payout_dispatches AS pd
    WHERE pd.recipient_user_id = v_user_id
      AND pd.kind = 'buddy_fee_final'
      AND pd.status = 'sent'
  ),
  tour_metrics AS (
    SELECT count(*) AS active_tours
    FROM public.itineraries AS i
    WHERE i.guide_id = v_user_id
      AND i.is_published = true
      AND i.deleted_at IS NULL
  )
  SELECT
    bookings.open_inquiries AS open_inquiries_count,
    bookings.upcoming_trips AS upcoming_trips_count,
    bookings.completed_trips AS completed_trips_count,
    reviews.average_rating,
    reviews.review_count,
    payouts.paid_earnings AS paid_earnings_paise,
    payouts.paid_earnings_current_month
      AS paid_earnings_current_month_paise,
    tours.active_tours AS active_tours_count,
    v_completion AS profile_completion_percent,
    v_missing AS profile_missing_fields,
    coalesce(v_profile_status, 'draft') AS profile_status,
    coalesce(v_profile_status = 'published', false) AS is_published,
    coalesce(v_is_active, false) AS is_active
  FROM booking_metrics AS bookings
  CROSS JOIN review_metrics AS reviews
  CROSS JOIN payout_metrics AS payouts
  CROSS JOIN tour_metrics AS tours;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_guide_dashboard_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_guide_dashboard_summary() FROM anon;
REVOKE ALL ON FUNCTION public.get_my_guide_dashboard_summary() FROM service_role;
GRANT EXECUTE ON FUNCTION public.get_my_guide_dashboard_summary()
  TO authenticated;
