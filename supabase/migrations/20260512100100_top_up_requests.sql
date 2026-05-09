-- ============================================================================
-- TOP-UP REQUESTS TABLE (Migration 2 of 5, Phase 4)
-- ============================================================================
-- During an in-progress trip, the buddy may run low on the agreed buffer and
-- ask the traveler for additional cash. This table holds each request, the
-- traveler's decision, and the linked Razorpay capture.
--
-- The state machine in mobile/lib/booking/stateMachine.ts is INTENTIONALLY
-- not aware of top-ups — they are invisible to booking.status and only
-- affect reconciliation math. Trip continues in `in_progress` throughout.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────
-- Enum
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE top_up_status AS ENUM (
    'pending',    -- buddy requested, awaiting traveler decision
    'approved',   -- traveler approved, awaiting razorpay capture
    'declined',   -- traveler declined
    'captured',   -- razorpay payment captured (terminal — money in escrow)
    'cancelled',  -- buddy withdrew the request before traveler decided
    'expired'     -- traveler did not decide within 15 min (cron-driven)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS top_up_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  created_by_user_id   uuid NOT NULL REFERENCES users(id),  -- always the buddy
  requested_paise      integer NOT NULL CHECK (requested_paise > 0),
  category             cost_category NOT NULL,
  purpose              text NOT NULL,
  status               top_up_status NOT NULL DEFAULT 'pending',
  created_at           timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  traveler_decided_at  timestamptz,
  razorpay_order_id    text,
  razorpay_payment_id  text,
  payment_event_id     uuid REFERENCES payment_events(id)
);

CREATE INDEX IF NOT EXISTS idx_top_up_requests_booking ON top_up_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_top_up_requests_status  ON top_up_requests(status);

-- One in-flight top-up at a time per booking. Partial unique covers the
-- traveler's Realtime sub (filter status IN (pending, approved)) — a
-- single row guarantees a stable subscription target.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_top_up_requests_inflight
  ON top_up_requests(booking_id)
  WHERE status IN ('pending', 'approved');

-- ─────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE top_up_requests ENABLE ROW LEVEL SECURITY;

-- READ: both parties on the booking
DROP POLICY IF EXISTS top_up_requests_read ON top_up_requests;
CREATE POLICY top_up_requests_read ON top_up_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (b.traveler_id = auth.uid() OR b.guide_id = auth.uid())
    )
  );

-- INSERT: only the buddy on the booking, and only with status='pending'.
-- We allow the row in; the status flips happen via the SECURITY DEFINER RPC
-- below so role-to-direction validation is centralized.
DROP POLICY IF EXISTS top_up_requests_insert_buddy ON top_up_requests;
CREATE POLICY top_up_requests_insert_buddy ON top_up_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.guide_id = auth.uid()
        AND b.status = 'in_progress'
    )
  );

-- UPDATE: denied at the table level. All transitions go through set_top_up_status.
-- (No UPDATE policy means UPDATE is denied for the authenticated role.)

-- ─────────────────────────────────────────────────────────────────
-- RPC: set_top_up_status
-- Centralized validation of role-to-direction transitions:
--   traveler may flip pending → approved/declined
--   buddy    may flip pending → cancelled
--   service  may flip pending → expired (used by cron)
--   service  may flip approved → captured (used by webhook)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_top_up_status(
  p_id uuid,
  p_new_status text  -- 'approved' | 'declined' | 'cancelled' | 'expired' | 'captured'
)
RETURNS top_up_requests
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_row    top_up_requests;
  v_caller uuid := auth.uid();
  v_is_traveler boolean;
  v_is_buddy    boolean;
  v_is_service  boolean := (auth.role() = 'service_role');
BEGIN
  SELECT * INTO v_row FROM top_up_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'top_up_request % not found', p_id;
  END IF;

  -- Identify caller's role on the booking
  SELECT (b.traveler_id = v_caller), (b.guide_id = v_caller)
    INTO v_is_traveler, v_is_buddy
    FROM bookings b WHERE b.id = v_row.booking_id;

  -- Service role bypass (used by cron + webhook)
  IF v_is_service THEN
    NULL;  -- allow any transition below
  ELSIF p_new_status IN ('approved', 'declined') THEN
    IF NOT v_is_traveler THEN
      RAISE EXCEPTION 'only traveler may % a top-up request', p_new_status;
    END IF;
    IF v_row.status <> 'pending' THEN
      RAISE EXCEPTION 'cannot % top-up request in status %', p_new_status, v_row.status;
    END IF;
  ELSIF p_new_status = 'cancelled' THEN
    IF NOT v_is_buddy THEN
      RAISE EXCEPTION 'only buddy may cancel a top-up request';
    END IF;
    IF v_row.status NOT IN ('pending', 'approved') THEN
      RAISE EXCEPTION 'cannot cancel top-up request in status %', v_row.status;
    END IF;
  ELSE
    -- 'expired', 'captured' are service-only
    RAISE EXCEPTION 'transition to % is service-role only', p_new_status;
  END IF;

  UPDATE top_up_requests
     SET status              = p_new_status::top_up_status,
         traveler_decided_at = CASE
                                 WHEN p_new_status IN ('approved', 'declined')
                                 THEN now() ELSE traveler_decided_at END
   WHERE id = p_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION set_top_up_status(uuid, text) TO authenticated, service_role;

-- Realtime: enable so the traveler's useTopUpRequest hook can subscribe.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE top_up_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
