-- ============================================================================
-- NO-SHOW EVENT — trip-day lifecycle gap (APP_REVIEW §P0)
-- ============================================================================
-- If the QR is never scanned on trip day, `trip_ready` previously persisted
-- forever — neither party could be marked as not showing up. This migration:
--
--   1. Adds two terminal booking_status values:
--        no_show_traveler — the traveler failed to show
--        no_show_buddy    — the buddy failed to show
--
--   2. Extends compute_cancellation_resolution_tx with two new triggers:
--        'no_show_buddy'    → tier 'buddy_no_show'    → no_show_buddy
--        'no_show_traveler' → tier 'traveler_no_show' → no_show_traveler
--      Both RAISE unless the booking is currently 'trip_ready' — a no-show
--      can only happen before the QR scan, at least two hours after the start.
--      Party reports require a separate, audited admin confirmation.
--
-- Money semantics (docs/financial/financial-model-handoff.md §7 truth table):
--   * buddy_no_show  = the documented "Buddy no-show on trip day" row, which
--     is identical to buddy_cancel: traveler deposit refunded, buddy deposit
--     forfeited, full balance (trip pot + buddy fee) refunded, ₹500 platform
--     credit to the traveler, buddy permanently banned (banned_reason
--     'buddy_no_show').
--   * traveler_no_show = the "Traveler cancels <24h pre-trip" row: traveler
--     deposit + paid balance convert to 30-day credit vouchers, buddy deposit
--     refunded.
--     TODO(gaurav): buddy compensation on traveler no-show is an open owner
--     decision — currently the buddy only gets their deposit back even though
--     they showed up and lost the working slot.
--
-- Economics mirror apps/mobile/lib/booking/cancellationSnapshot.ts. Lifecycle
-- transitions use the shared domain/stateMachine.ts reducer.
-- ============================================================================

-- ─── New booking_status enum values ─────────────────────────────────────────
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'no_show_traveler';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'no_show_buddy';

-- ─── Resolver with no-show triggers ─────────────────────────────────────────
-- Base: 20260707100000_platform_cancel_force_majeure.sql (latest version).
CREATE OR REPLACE FUNCTION compute_cancellation_resolution_tx(
  p_booking_id   uuid,
  p_trigger      text,   -- 'voluntary' | 't_minus_12_no_pay' | 'force_majeure_verified' | 'deposit_window_expired' | 'no_show_traveler' | 'no_show_buddy'
  p_actor        text    -- 'traveler' | 'buddy' | 'platform' | 'system'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_booking            bookings%ROWTYPE;
  v_agreement          agreements%ROWTYPE;
  v_tier               text;
  v_next_status        text;
  v_traveler_deposit   jsonb;
  v_buddy_deposit      jsonb;
  v_itin_buffer        jsonb;
  v_buddy_fee          jsonb;
  v_late_fee           jsonb;
  v_platform_credit    jsonb;
  v_buddy_ban          boolean := false;
  v_ban_reason         text;
  v_total_refunded     integer := 0;
  v_pg_fee             integer;
  v_resolution         jsonb;
  v_hours_until_trip   numeric;
  v_balance_paid       boolean := false;   -- true when payment_events has a captured 'balance' row
  v_trip_pot_paise     integer := 0;       -- itinerary_fund + buffer + captured top-ups
  -- payout constants
  c_deposit_paise      constant integer := 50000;     -- ₹500
  c_platform_credit    constant integer := 50000;     -- ₹500
  c_pg_fee_rate        constant numeric := 0.02;      -- 2%
BEGIN
  -- ── Lock the booking row for this transaction ──────────────────────────
  SELECT * INTO v_booking
    FROM bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- ── No-show triggers are only legal from trip_ready (trip day, QR never
  --    scanned). Checked before any tier computation so a stale/mistaken
  --    call can never move money. The 2h reporting grace window is enforced
  --    by the callers (mark-no-show edge fn; admin-api is exempt).
  IF p_trigger IN ('no_show_traveler', 'no_show_buddy')
     AND v_booking.status <> 'trip_ready' THEN
    RAISE EXCEPTION 'no-show requires trip_ready, booking % is %',
      p_booking_id, v_booking.status;
  END IF;

  -- ── Load latest agreement (for amounts) ───────────────────────────────
  SELECT * INTO v_agreement
    FROM agreements
   WHERE booking_id = p_booking_id
   ORDER BY created_at DESC
   LIMIT 1;

  -- ── Compute hours until trip (using agreements.trip_starts_at) ─────────
  IF v_agreement.trip_starts_at IS NOT NULL THEN
    v_hours_until_trip := EXTRACT(EPOCH FROM (v_agreement.trip_starts_at - now())) / 3600.0;
  ELSE
    -- Fallback to bookings.tour_start_time for pre-Phase-2 bookings.
    v_hours_until_trip := EXTRACT(EPOCH FROM (v_booking.tour_start_time - now())) / 3600.0;
  END IF;

  IF p_trigger IN ('no_show_traveler', 'no_show_buddy') AND (v_hours_until_trip IS NULL OR v_hours_until_trip > -2) THEN
    RAISE EXCEPTION 'no_show_grace_period';
  END IF;

  -- ── Check whether the balance payment has been captured ───────────────
  SELECT EXISTS (
    SELECT 1 FROM payment_events
     WHERE booking_id = p_booking_id
       AND kind = 'balance'
       AND status = 'captured'
  ) INTO v_balance_paid;

  -- ── Compute trip pot (itin + buffer + captured top-ups) ───────────────
  IF v_agreement.id IS NOT NULL THEN
    SELECT v_agreement.itinerary_fund_paise + v_agreement.buffer_paise +
           COALESCE((
             SELECT SUM(amount_paise)
               FROM payment_events
              WHERE booking_id = p_booking_id
                AND kind = 'top_up'
                AND status = 'captured'
           ), 0)
    INTO v_trip_pot_paise;
  END IF;

  -- ── Determine the tier ─────────────────────────────────────────────────
  IF p_trigger = 'force_majeure_verified' THEN
    v_tier        := 'force_majeure';
    v_next_status := 'cancelled_force_majeure';
  ELSIF p_trigger = 'deposit_window_expired' THEN
    v_tier        := 'pre_signing';
    v_next_status := 'cancelled_no_deposit';
  ELSIF p_trigger = 't_minus_12_no_pay' THEN
    v_tier        := 'late_no_pay';
    v_next_status := 'cancelled_no_pay';
  ELSIF p_trigger = 'no_show_buddy' THEN
    -- "Buddy no-show on trip day" — §7 truth table row, identical economics
    -- to buddy_cancel (incl. platform credit + permanent ban).
    v_tier        := 'buddy_no_show';
    v_next_status := 'no_show_buddy';
  ELSIF p_trigger = 'no_show_traveler' THEN
    -- No dedicated §7 row; reuses the "Traveler cancels <24h" economics
    -- (voucher conversion, buddy deposit refunded).
    v_tier        := 'traveler_no_show';
    v_next_status := 'no_show_traveler';
  ELSIF p_actor = 'buddy' THEN
    v_tier        := 'buddy_cancel';
    v_next_status := 'cancelled_buddy';
  ELSIF p_actor = 'traveler' THEN
    IF v_hours_until_trip > 72 THEN
      v_tier := 'gt_72h';
    ELSIF v_hours_until_trip >= 24 THEN
      v_tier := '24_to_72h';
    ELSE
      v_tier := 'lt_24h';
    END IF;
    v_next_status := 'cancelled_traveler_voluntary';
  ELSIF p_actor IN ('platform', 'system') THEN
    -- Platform/system-initiated cancellation: neither party is at fault.
    -- Force-majeure economics — full refunds, late fee waived, no ban.
    v_tier        := 'force_majeure';
    v_next_status := 'cancelled_force_majeure';
  ELSE
    RAISE EXCEPTION 'Unknown actor: %', p_actor;
  END IF;

  -- ── Resolve each component per the truth table ─────────────────────────

  -- Helper patterns (inline with CASE):
  --   deposit held?  → FROM deposits WHERE booking_id AND side
  -- We check the deposits table for current status.

  -- Defaults
  v_traveler_deposit := '{"fate":"not_paid","amount_paise":0}'::jsonb;
  v_buddy_deposit    := '{"fate":"not_paid","amount_paise":0}'::jsonb;
  v_itin_buffer      := '{"fate":"not_paid","amount_paise":0}'::jsonb;
  v_buddy_fee        := '{"fate":"not_paid","amount_paise":0}'::jsonb;
  v_late_fee         := '{"fate":"waived","amount_paise":0}'::jsonb;
  v_platform_credit  := jsonb_build_object('issue_to_user_id', NULL, 'amount_paise', 0);

  CASE v_tier

    WHEN 'gt_72h', 'pre_signing' THEN
      -- Full refund of held deposits; buffer/fee not paid yet (or full refund if paid).
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'traveler' AND status = 'held') THEN
        v_traveler_deposit := jsonb_build_object('fate','refunded','amount_paise',c_deposit_paise);
        v_total_refunded   := v_total_refunded + c_deposit_paise;
      END IF;
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'buddy' AND status = 'held') THEN
        v_buddy_deposit  := jsonb_build_object('fate','refunded','amount_paise',c_deposit_paise);
        v_total_refunded := v_total_refunded + c_deposit_paise;
      END IF;
      IF v_balance_paid AND v_agreement.id IS NOT NULL THEN
        v_itin_buffer    := jsonb_build_object('fate','refunded','amount_paise', v_trip_pot_paise);
        v_buddy_fee      := jsonb_build_object('fate','refunded','amount_paise', v_agreement.buddy_fee_paise);
        v_total_refunded := v_total_refunded + v_trip_pot_paise + v_agreement.buddy_fee_paise;
      END IF;

    WHEN '24_to_72h' THEN
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'traveler' AND status = 'held') THEN
        v_traveler_deposit := jsonb_build_object('fate','refunded','amount_paise', c_deposit_paise / 2);
        v_total_refunded   := v_total_refunded + c_deposit_paise / 2;
      END IF;
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'buddy' AND status = 'held') THEN
        v_buddy_deposit  := jsonb_build_object('fate','refunded','amount_paise', c_deposit_paise);
        v_total_refunded := v_total_refunded + c_deposit_paise;
      END IF;
      IF v_balance_paid AND v_agreement.id IS NOT NULL THEN
        v_itin_buffer    := jsonb_build_object('fate','refunded','amount_paise', v_trip_pot_paise / 2);
        v_buddy_fee      := jsonb_build_object('fate','refunded','amount_paise', v_agreement.buddy_fee_paise / 2);
        v_total_refunded := v_total_refunded + v_trip_pot_paise / 2 + v_agreement.buddy_fee_paise / 2;
      END IF;

    WHEN 'lt_24h', 'traveler_no_show' THEN
      -- traveler_no_show: TODO(gaurav) buddy compensation on traveler no-show
      -- is an open owner decision; currently buddy only gets their deposit
      -- back even though they showed up and lost the working slot.
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'traveler' AND status = 'held') THEN
        v_traveler_deposit := jsonb_build_object('fate','voucher','amount_paise',c_deposit_paise,'voucher_paise',c_deposit_paise);
      END IF;
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'buddy' AND status = 'held') THEN
        v_buddy_deposit  := jsonb_build_object('fate','refunded','amount_paise',c_deposit_paise);
        v_total_refunded := v_total_refunded + c_deposit_paise;
      END IF;
      IF v_balance_paid AND v_agreement.id IS NOT NULL THEN
        v_itin_buffer := jsonb_build_object('fate','voucher','amount_paise',v_trip_pot_paise,'voucher_paise',v_trip_pot_paise);
        v_buddy_fee   := jsonb_build_object('fate','voucher','amount_paise',v_agreement.buddy_fee_paise,'voucher_paise',v_agreement.buddy_fee_paise);
      END IF;

    WHEN 'late_no_pay' THEN
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'traveler' AND status = 'held') THEN
        v_traveler_deposit := jsonb_build_object('fate','forfeited','amount_paise',c_deposit_paise);
      END IF;
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'buddy' AND status = 'held') THEN
        v_buddy_deposit  := jsonb_build_object('fate','refunded','amount_paise',c_deposit_paise);
        v_total_refunded := v_total_refunded + c_deposit_paise;
      END IF;
      IF v_booking.late_fee_paise > 0 THEN
        v_late_fee := jsonb_build_object('fate','forfeited','amount_paise',v_booking.late_fee_paise);
      ELSE
        v_late_fee := '{"fate":"waived","amount_paise":0}'::jsonb;
      END IF;

    WHEN 'buddy_cancel', 'buddy_no_show' THEN
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'traveler' AND status = 'held') THEN
        v_traveler_deposit := jsonb_build_object('fate','refunded','amount_paise',c_deposit_paise);
        v_total_refunded   := v_total_refunded + c_deposit_paise;
      END IF;
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'buddy' AND status = 'held') THEN
        v_buddy_deposit := jsonb_build_object('fate','forfeited','amount_paise',c_deposit_paise);
      END IF;
      IF v_balance_paid AND v_agreement.id IS NOT NULL THEN
        v_itin_buffer    := jsonb_build_object('fate','refunded','amount_paise',v_trip_pot_paise);
        v_buddy_fee      := jsonb_build_object('fate','refunded','amount_paise',v_agreement.buddy_fee_paise);
        v_total_refunded := v_total_refunded + v_trip_pot_paise + v_agreement.buddy_fee_paise;
      END IF;
      v_platform_credit := jsonb_build_object('issue_to_user_id', v_booking.traveler_id::text, 'amount_paise', c_platform_credit);
      v_buddy_ban       := true;
      v_ban_reason      := v_tier;   -- 'buddy_cancel' | 'buddy_no_show'

    WHEN 'force_majeure' THEN
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'traveler' AND status = 'held') THEN
        v_traveler_deposit := jsonb_build_object('fate','refunded','amount_paise',c_deposit_paise);
        v_total_refunded   := v_total_refunded + c_deposit_paise;
      END IF;
      IF EXISTS (SELECT 1 FROM deposits WHERE booking_id = p_booking_id AND side = 'buddy' AND status = 'held') THEN
        v_buddy_deposit  := jsonb_build_object('fate','refunded','amount_paise',c_deposit_paise);
        v_total_refunded := v_total_refunded + c_deposit_paise;
      END IF;
      IF v_balance_paid AND v_agreement.id IS NOT NULL THEN
        v_itin_buffer    := jsonb_build_object('fate','refunded','amount_paise',v_trip_pot_paise);
        v_buddy_fee      := jsonb_build_object('fate','refunded','amount_paise',v_agreement.buddy_fee_paise);
        v_total_refunded := v_total_refunded + v_trip_pot_paise + v_agreement.buddy_fee_paise;
      END IF;
      IF v_booking.late_fee_paise > 0 THEN
        v_late_fee := jsonb_build_object('fate','waived','amount_paise',v_booking.late_fee_paise);
      END IF;

  END CASE;

  -- ── PG fee: 2% of cash-moving components, borne by platform ───────────
  v_pg_fee := ROUND(v_total_refunded * c_pg_fee_rate);

  -- ── Build resolution JSONB ─────────────────────────────────────────────
  v_resolution := jsonb_build_object(
    'trigger',              p_trigger,
    'trigger_actor',        p_actor,
    'tier',                 v_tier,
    'hours_until_trip',     v_hours_until_trip,
    'traveler_deposit',     v_traveler_deposit,
    'buddy_deposit',        v_buddy_deposit,
    'itinerary_buffer',     v_itin_buffer,
    'buddy_fee',            v_buddy_fee,
    'late_fee',             v_late_fee,
    'platform_credit',      v_platform_credit,
    'pg_fee_paise',         v_pg_fee,
    'pg_fee_borne_by',      'platform',
    'buddy_ban',            v_buddy_ban,
    'next_booking_status',  v_next_status
  );

  -- ── Side-effects ───────────────────────────────────────────────────────

  -- 1. Write payout_dispatches rows for cash moves (status='pending').
  --    Refunds go back to whoever originally paid.
  --    Each row uses INSERT ... ON CONFLICT DO NOTHING for idempotency.

  -- Traveler deposit refund
  IF (v_traveler_deposit->>'fate') = 'refunded' THEN
    INSERT INTO payout_dispatches
      (booking_id, kind, recipient_user_id, gross_paise, net_paise)
    VALUES
      (p_booking_id, 'traveler_deposit_refund', v_booking.traveler_id,
       (v_traveler_deposit->>'amount_paise')::integer,
       (v_traveler_deposit->>'amount_paise')::integer)
    ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING;
  END IF;

  -- Buddy deposit refund
  IF (v_buddy_deposit->>'fate') = 'refunded' THEN
    INSERT INTO payout_dispatches
      (booking_id, kind, recipient_user_id, gross_paise, net_paise)
    VALUES
      (p_booking_id, 'buddy_deposit_refund', v_booking.guide_id,
       (v_buddy_deposit->>'amount_paise')::integer,
       (v_buddy_deposit->>'amount_paise')::integer)
    ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING;
  END IF;

  -- Trip fund refund to traveler (itin+buffer component)
  IF (v_itin_buffer->>'fate') = 'refunded' THEN
    INSERT INTO payout_dispatches
      (booking_id, kind, recipient_user_id, gross_paise, net_paise)
    VALUES
      (p_booking_id, 'trip_fund_cancellation_refund', v_booking.traveler_id,
       (v_itin_buffer->>'amount_paise')::integer,
       (v_itin_buffer->>'amount_paise')::integer)
    ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING;
  END IF;

  -- Buddy fee refund (buddy_cancel / buddy_no_show / force_majeure)
  IF (v_buddy_fee->>'fate') = 'refunded' THEN
    INSERT INTO payout_dispatches
      (booking_id, kind, recipient_user_id, gross_paise, net_paise)
    VALUES
      (p_booking_id, 'buddy_fee_cancellation_refund', v_booking.traveler_id,
       (v_buddy_fee->>'amount_paise')::integer,
       (v_buddy_fee->>'amount_paise')::integer)
    ON CONFLICT (booking_id, kind, recipient_user_id) DO NOTHING;
  END IF;

  -- 2. Update deposits to 'refunded' where fate = 'refunded'
  IF (v_traveler_deposit->>'fate') = 'refunded' THEN
    UPDATE deposits SET status = 'refunded' WHERE booking_id = p_booking_id AND side = 'traveler' AND status = 'held';
  END IF;
  IF (v_buddy_deposit->>'fate') = 'refunded' THEN
    UPDATE deposits SET status = 'refunded' WHERE booking_id = p_booking_id AND side = 'buddy'    AND status = 'held';
  END IF;

  -- 3. Ban buddy if necessary (cancel and no-show carry distinct reasons)
  IF v_buddy_ban THEN
    UPDATE users SET is_banned = true, banned_at = now(), banned_reason = v_ban_reason
     WHERE id = v_booking.guide_id AND (is_banned IS NULL OR is_banned = false);
  END IF;

  -- 4. Write resolution + transition booking status
  UPDATE bookings
     SET status                     = v_next_status::booking_status,
         cancelled_at               = now(),
         cancelled_by_user_id       = CASE p_actor
                                        WHEN 'traveler' THEN v_booking.traveler_id
                                        WHEN 'buddy'    THEN v_booking.guide_id
                                        ELSE NULL END,
         cancellation_trigger_event = p_trigger,
         cancelled_resolution_jsonb = v_resolution
   WHERE id = p_booking_id;

  RETURN v_resolution;
END;
$$;

-- ─── Privileges (self-contained re-assert; OR REPLACE preserves them, but a
--     fresh environment applies migrations in order and 20260726101000 ran
--     before this function shape existed) ──────────────────────────────────
REVOKE ALL
  ON FUNCTION public.compute_cancellation_resolution_tx(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.compute_cancellation_resolution_tx(uuid, text, text)
  TO service_role;
