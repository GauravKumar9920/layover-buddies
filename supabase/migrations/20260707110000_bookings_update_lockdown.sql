-- ============================================================================
-- LOCKDOWN: bookings UPDATE from end-user clients
-- ============================================================================
-- The 20260414 policies ("Guides/Travelers can update own bookings") were
-- FOR UPDATE USING (auth.uid() = party) with no WITH CHECK and no column
-- restriction: either participant could PATCH status, payment_status, or any
-- amount column via the anon key, bypassing the state machine that is only
-- enforced in edge functions. This migration reduces the client's write
-- surface to exactly what the app legitimately does client-side:
--
--   * guide accepts an inquiry:        chat_open           → agreement_drafting
--   * either party cancels pre-signing: chat_open/agreement_*/pending
--                                                          → cancelled_pre_signing
--
-- Everything else (deposits, balance, trip lifecycle, monied cancellations)
-- flows through service-role edge functions / SECURITY DEFINER RPCs, which
-- are exempt from the trigger below and unaffected by the grants.
--
-- Three layers:
--   1. Policies recreated with WITH CHECK (row may not leave the party's scope).
--   2. Column-level grants: authenticated may UPDATE only (status, cancelled_by).
--   3. BEFORE UPDATE trigger validating status transitions for end-user roles.
-- ============================================================================

-- ── 1. Recreate UPDATE policies with WITH CHECK ─────────────────────────────

DROP POLICY IF EXISTS "Guides can update own bookings" ON bookings;
CREATE POLICY "Guides can update own bookings" ON bookings
  FOR UPDATE
  USING      (auth.uid() = guide_id)
  WITH CHECK (auth.uid() = guide_id);

DROP POLICY IF EXISTS "Travelers can update own bookings" ON bookings;
CREATE POLICY "Travelers can update own bookings" ON bookings
  FOR UPDATE
  USING      (auth.uid() = traveler_id)
  WITH CHECK (auth.uid() = traveler_id);

-- ── 2. Column-level grants ──────────────────────────────────────────────────
-- End users may only ever write status and cancelled_by. payment_status,
-- amounts, trip_qr_token, cancellation fields, etc. become server-only.

REVOKE UPDATE ON bookings FROM anon;
REVOKE UPDATE ON bookings FROM authenticated;
GRANT  UPDATE (status, cancelled_by) ON bookings TO authenticated;

-- ── 3. Transition-validating trigger for end-user writes ────────────────────
-- SECURITY INVOKER (default) on purpose: inside the trigger, current_user is
-- the role PostgREST assumed for the request ('authenticated'/'anon' for end
-- users, 'service_role' for edge functions and the admin console) or
-- 'postgres' inside SECURITY DEFINER RPCs and cron bodies. Only end-user
-- roles are constrained.

CREATE OR REPLACE FUNCTION enforce_booking_client_transitions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Trusted server-side writers enforce the state machine themselves.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Defense in depth alongside the column grants: a booking can never be
  -- reassigned to different parties by a client.
  IF NEW.traveler_id IS DISTINCT FROM OLD.traveler_id
     OR NEW.guide_id IS DISTINCT FROM OLD.guide_id THEN
    RAISE EXCEPTION 'booking_parties_immutable';
  END IF;

  -- `cancelled_by` is meaningful only as part of a permitted cancellation.
  -- Never let a participant rewrite attribution on an otherwise unchanged
  -- booking.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by THEN
      RAISE EXCEPTION 'cancelled_by_requires_cancellation';
    END IF;
    RETURN NEW;
  END IF;

  -- Guide accepts an inquiry. Sending the agreement must use
  -- send_agreement_tx so agreement status, canonical money/timing snapshots,
  -- and booking status commit atomically.
  IF v_uid = OLD.guide_id
     AND NEW.cancelled_by IS NOT DISTINCT FROM OLD.cancelled_by
     AND OLD.status = 'chat_open'
     AND NEW.status = 'agreement_drafting' THEN
    RETURN NEW;
  END IF;

  -- Either party may cancel while no money is held (pre-signing states;
  -- 'pending' is the legacy shim for agreement_sent).
  IF (v_uid = OLD.guide_id OR v_uid = OLD.traveler_id)
     AND OLD.status IN ('chat_open', 'agreement_drafting', 'agreement_sent',
                        'agreement_signed_traveler', 'agreement_signed_buddy',
                        'pending')
     AND NEW.status = 'cancelled_pre_signing'
     AND NEW.cancelled_by = (CASE
       WHEN v_uid = OLD.guide_id THEN 'guide'
       ELSE 'traveler'
     END) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'booking_transition_not_allowed: % -> %', OLD.status, NEW.status
    USING HINT = 'This transition must go through an edge function.';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_client_transitions ON bookings;
CREATE TRIGGER trg_enforce_booking_client_transitions
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_client_transitions();
