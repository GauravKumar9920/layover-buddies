-- Atomic daily Search Console replacement. A provider retry cannot leave a
-- partially deleted day or mix stale rows with the newly fetched snapshot.

CREATE OR REPLACE FUNCTION public.replace_search_console_day_tx(
  p_site_url text,
  p_metric_date date,
  p_search_type text,
  p_rows jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_site_url IS NULL OR length(p_site_url) < 4 OR length(p_site_url) > 512 THEN
    RAISE EXCEPTION 'invalid_search_console_site';
  END IF;
  IF p_metric_date IS NULL OR p_metric_date > current_date OR p_metric_date < current_date - 31 THEN
    RAISE EXCEPTION 'invalid_search_console_date';
  END IF;
  IF p_search_type NOT IN ('web', 'image', 'video', 'news', 'discover', 'googleNews') THEN
    RAISE EXCEPTION 'invalid_search_type';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 25000 THEN
    RAISE EXCEPTION 'invalid_search_rows';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_rows) AS row(
        query text, page text, device text, country text,
        clicks bigint, impressions bigint, ctr numeric, position numeric
      )
     WHERE row.clicks < 0 OR row.impressions < 0
        OR row.ctr < 0 OR row.ctr > 1 OR row.position < 0
        OR length(COALESCE(row.query, '')) > 2048
        OR length(COALESCE(row.page, '')) > 4096
        OR length(COALESCE(row.device, '')) > 32
        OR length(COALESCE(row.country, '')) > 8
  ) THEN
    RAISE EXCEPTION 'invalid_search_row';
  END IF;

  DELETE FROM public.search_console_daily
   WHERE site_url = p_site_url
     AND metric_date = p_metric_date
     AND search_type = p_search_type;

  INSERT INTO public.search_console_daily
    (metric_date, site_url, search_type, query, page, device, country,
     clicks, impressions, ctr, position, synced_at)
  SELECT
    p_metric_date, p_site_url, p_search_type,
    COALESCE(row.query, ''), COALESCE(row.page, ''),
    COALESCE(row.device, ''), COALESCE(row.country, ''),
    COALESCE(row.clicks, 0), COALESCE(row.impressions, 0),
    COALESCE(row.ctr, 0), COALESCE(row.position, 0), now()
  FROM jsonb_to_recordset(p_rows) AS row(
    query text, page text, device text, country text,
    clicks bigint, impressions bigint, ctr numeric, position numeric
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_search_console_day_tx(text, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_search_console_day_tx(text, date, text, jsonb) TO service_role;

-- Exact ledger aggregate. This deliberately runs in SQL rather than fetching
-- a capped browser/server page and summing in JavaScript. NULL p_start_date is
-- the explicit all-time semantic and returns the actual earliest ledger date.
CREATE OR REPLACE FUNCTION public.admin_finance_summary(
  p_start_date date,
  p_end_date date
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_end date := COALESCE(p_end_date, current_date);
  v_actual_start date;
  v_captured bigint;
  v_refunded bigint;
  v_paid_out bigint;
  v_pending bigint;
BEGIN
  IF v_end > current_date + 1 OR p_start_date > v_end THEN
    RAISE EXCEPTION 'invalid_finance_date_range';
  END IF;
  IF p_start_date IS NOT NULL AND v_end - p_start_date > 366 THEN
    RAISE EXCEPTION 'finance_date_range_too_large';
  END IF;

  SELECT min(day) INTO v_actual_start
  FROM (
    SELECT min(COALESCE(captured_at, initiated_at)::date) AS day
      FROM public.payment_events
     WHERE COALESCE(captured_at, initiated_at) < (v_end + 1)::timestamptz
    UNION ALL
    SELECT min(COALESCE(completed_at, initiated_at)::date) AS day
      FROM public.payout_dispatches
     WHERE COALESCE(completed_at, initiated_at) < (v_end + 1)::timestamptz
  ) AS earliest;

  SELECT COALESCE(sum(amount_paise), 0)::bigint INTO v_captured
    FROM public.payment_events
   WHERE status::text = 'captured'
     AND COALESCE(captured_at, initiated_at) >= COALESCE(p_start_date, '-infinity'::date)::timestamptz
     AND COALESCE(captured_at, initiated_at) < (v_end + 1)::timestamptz;

  SELECT
    COALESCE(sum(net_paise) FILTER (
      WHERE status::text = 'sent' AND kind::text = ANY (ARRAY[
        'traveler_refund', 'traveler_deposit_refund', 'buddy_deposit_refund',
        'trip_fund_cancellation_refund', 'buddy_fee_cancellation_refund',
        'cancellation_refund', 'force_majeure_refund'
      ])
    ), 0)::bigint,
    COALESCE(sum(net_paise) FILTER (
      WHERE status::text = 'sent' AND kind::text = ANY (ARRAY['buddy_fee_final', 'trip_pot_release'])
    ), 0)::bigint,
    COALESCE(sum(net_paise) FILTER (WHERE status::text = 'pending'), 0)::bigint
  INTO v_refunded, v_paid_out, v_pending
  FROM public.payout_dispatches
  WHERE COALESCE(completed_at, initiated_at) >= COALESCE(p_start_date, '-infinity'::date)::timestamptz
    AND COALESCE(completed_at, initiated_at) < (v_end + 1)::timestamptz;

  RETURN jsonb_build_object(
    'capturedPaise', v_captured,
    'refundedPaise', v_refunded,
    'payoutPaise', v_paid_out,
    'platformRevenuePaise', v_captured - v_refunded - v_paid_out,
    'pendingPaise', v_pending,
    'reconciliationDeltaPaise', v_captured - v_refunded - v_paid_out - v_pending,
    'periodStart', COALESCE(p_start_date, v_actual_start),
    'periodEnd', v_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_finance_summary(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_finance_summary(date, date) TO service_role;

-- Aggregates detailed daily rows before they cross the function boundary.
-- Totals are exact for the stored directional snapshot and are never derived
-- from a truncated PostgREST page.
CREATE OR REPLACE FUNCTION public.raise_admin_growth_input_error()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'invalid_growth_report_input';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_search_console_report(
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 100
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH validated AS (
    SELECT
      CASE
        WHEN p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date
          OR p_end_date - p_start_date > 365
          OR p_limit < 1 OR p_limit > 500
        THEN public.raise_admin_growth_input_error()
        ELSE true
      END AS ok
  ), grouped AS (
    SELECT
      sc.query,
      sc.page,
      sc.device,
      sc.country,
      sum(sc.clicks)::bigint AS clicks,
      sum(sc.impressions)::bigint AS impressions,
      CASE WHEN sum(sc.impressions) = 0 THEN 0
        ELSE sum(sc.clicks)::numeric / sum(sc.impressions)::numeric END AS ctr,
      CASE WHEN sum(sc.impressions) = 0 THEN 0
        ELSE sum(sc.position * sc.impressions)::numeric / sum(sc.impressions)::numeric END AS position
    FROM public.search_console_daily AS sc, validated
    WHERE validated.ok
      AND sc.metric_date BETWEEN p_start_date AND p_end_date
    GROUP BY sc.query, sc.page, sc.device, sc.country
  ), top_rows AS (
    SELECT * FROM grouped ORDER BY impressions DESC, clicks DESC LIMIT p_limit
  ), totals AS (
    SELECT
      COALESCE(sum(clicks), 0)::bigint AS clicks,
      COALESCE(sum(impressions), 0)::bigint AS impressions,
      CASE WHEN COALESCE(sum(impressions), 0) = 0 THEN 0
        ELSE sum(clicks)::numeric / sum(impressions)::numeric END AS ctr,
      CASE WHEN COALESCE(sum(impressions), 0) = 0 THEN 0
        ELSE sum(position * impressions)::numeric / sum(impressions)::numeric END AS position
    FROM grouped
  ), freshness AS (
    SELECT max(synced_at) AS synced_at, min(metric_date) AS first_date, max(metric_date) AS last_date
      FROM public.search_console_daily
     WHERE metric_date BETWEEN p_start_date AND p_end_date
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(top_rows)) FROM top_rows), '[]'::jsonb),
    'totals', to_jsonb(totals),
    'syncedAt', freshness.synced_at,
    'dataAvailableSince', freshness.first_date,
    'dataThrough', freshness.last_date
  )
  FROM totals CROSS JOIN freshness;
$$;

REVOKE ALL ON FUNCTION public.raise_admin_growth_input_error() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_search_console_report(date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_console_report(date, date, integer) TO service_role;

-- Connected first-party acquisition funnel. Individual contact and flight
-- fields never enter this result; redacted leads contribute through the daily
-- archive while active leads are aggregated live.
CREATE OR REPLACE FUNCTION public.admin_marketing_attribution_report(
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 100
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH validated AS (
    SELECT CASE
      WHEN p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date
        OR p_end_date - p_start_date > 365 OR p_limit < 1 OR p_limit > 500
      THEN public.raise_admin_growth_input_error()
      ELSE true
    END AS ok
  ), live AS (
    SELECT ml.created_at::date AS metric_date,
           COALESCE(NULLIF(ml.last_attribution->>'utm_source', ''), NULLIF(ml.first_attribution->>'utm_source', ''),
                    NULLIF(ml.first_attribution->>'attribution_first_source', ''), '(direct)') AS source,
           COALESCE(NULLIF(ml.last_attribution->>'utm_medium', ''), NULLIF(ml.first_attribution->>'utm_medium', ''), '(none)') AS medium,
           COALESCE(NULLIF(ml.last_attribution->>'utm_campaign', ''), NULLIF(ml.first_attribution->>'utm_campaign', ''), '(not set)') AS campaign,
           ml.landing_page,
           1::bigint AS leads,
           (ml.status IN ('qualified', 'converted'))::integer::bigint AS qualified_leads,
           (ml.linked_booking_id IS NOT NULL)::integer::bigint AS linked_bookings,
           COALESCE((b.status::text IN ('completed', 'rated'))::integer, 0)::bigint AS completed_trips
      FROM public.marketing_leads AS ml
      LEFT JOIN public.bookings AS b ON b.id = ml.linked_booking_id
      CROSS JOIN validated
     WHERE validated.ok
       AND ml.pii_redacted_at IS NULL
       AND ml.created_at::date BETWEEN p_start_date AND p_end_date
  ), combined AS (
    SELECT metric_date, source, medium, campaign, landing_page,
           leads, qualified_leads, linked_bookings, completed_trips
      FROM live
    UNION ALL
    SELECT metric_date, source, medium, campaign, landing_page,
           leads, qualified_leads, linked_bookings, completed_trips
      FROM public.marketing_attribution_daily
     WHERE metric_date BETWEEN p_start_date AND p_end_date
  ), grouped AS (
    SELECT source, medium, campaign, landing_page,
           sum(leads)::bigint AS leads,
           sum(qualified_leads)::bigint AS qualified_leads,
           sum(linked_bookings)::bigint AS bookings,
           sum(completed_trips)::bigint AS completed_trips
      FROM combined
     GROUP BY source, medium, campaign, landing_page
     ORDER BY leads DESC, bookings DESC
     LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(jsonb_build_object(
      'dimensions', jsonb_build_object(
        'provider', 'detour', 'source', source, 'medium', medium,
        'campaign', campaign, 'landingPage', landing_page
      ),
      'metrics', jsonb_build_object(
        'leads', leads, 'qualifiedLeads', qualified_leads,
        'bookings', bookings, 'completedTrips', completed_trips
      )
    )), '[]'::jsonb)
  )
  FROM grouped;
$$;

REVOKE ALL ON FUNCTION public.admin_marketing_attribution_report(date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_marketing_attribution_report(date, date, integer) TO service_role;
