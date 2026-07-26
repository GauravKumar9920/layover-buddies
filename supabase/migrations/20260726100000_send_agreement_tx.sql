-- ============================================================================
-- ATOMIC AGREEMENT SEND + BOOKING SYNC
-- ============================================================================
-- The bookings lockdown intentionally lets authenticated clients update only
-- (status, cancelled_by). Agreement send must also refresh denormalized
-- pricing/date fields, so the full operation belongs in one server transaction.
-- The caller supplies only an agreement id; all money and status values are
-- derived from rows the function locks and verifies.
-- ============================================================================

-- Shared lifecycle gate used by draft RPCs and the account-deletion workflow
-- later in this migration batch.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_pending_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Draft creation is also server-owned: the guide chooses trip terms, while
-- platform/GST/TDS rates are snapshotted from the active platform settings.
CREATE OR REPLACE FUNCTION public.create_agreement_draft_tx(
  p_booking_id uuid,
  p_trip_starts_at timestamptz,
  p_trip_ends_at timestamptz DEFAULT NULL
)
RETURNS SETOF public.agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid                         uuid := auth.uid();
  v_booking                     public.bookings%ROWTYPE;
  v_existing                    public.agreements%ROWTYPE;
  v_platform_fee_up_rate        numeric;
  v_platform_fee_down_rate      numeric;
  v_gst_rate                    numeric;
  v_tds_rate                    numeric;
  v_traveler_subtotal_paise     integer := 120;
  v_traveler_gst_paise          integer;
BEGIN
  IF v_uid IS NULL OR EXISTS (
    SELECT 1 FROM public.users
     WHERE id = v_uid AND deletion_pending_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'agreement_draft_forbidden';
  END IF;

  SELECT *
    INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found';
  END IF;

  IF v_booking.guide_id <> v_uid THEN
    RAISE EXCEPTION 'agreement_draft_forbidden';
  END IF;

  IF v_booking.status NOT IN ('chat_open', 'agreement_drafting') THEN
    RAISE EXCEPTION 'booking_not_draftable';
  END IF;

  SELECT *
    INTO v_existing
    FROM public.agreements
   WHERE booking_id = p_booking_id
     AND status = 'draft'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY
      SELECT * FROM public.agreements WHERE id = v_existing.id;
    RETURN;
  END IF;

  SELECT r.platform_fee_up_rate,
         r.platform_fee_down_rate,
         r.gst_rate,
         r.tds_rate
    INTO v_platform_fee_up_rate,
         v_platform_fee_down_rate,
         v_gst_rate,
         v_tds_rate
    FROM public.get_effective_rates() r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'platform_rates_unavailable';
  END IF;

  v_traveler_gst_paise :=
    round(v_traveler_subtotal_paise * v_gst_rate)::integer;

  INSERT INTO public.agreements (
    booking_id,
    drafted_by_user_id,
    status,
    buddy_fee_paise,
    itinerary_fund_paise,
    buffer_paise,
    gst_rate,
    platform_fee_up_rate,
    platform_fee_down_rate,
    tds_rate,
    traveler_subtotal_paise,
    traveler_gst_paise,
    traveler_total_paise,
    trip_starts_at,
    trip_ends_at
  )
  VALUES (
    p_booking_id,
    v_uid,
    'draft',
    0,
    100,
    20,
    v_gst_rate,
    v_platform_fee_up_rate,
    v_platform_fee_down_rate,
    v_tds_rate,
    v_traveler_subtotal_paise,
    v_traveler_gst_paise,
    v_traveler_subtotal_paise + v_traveler_gst_paise + 50000,
    p_trip_starts_at,
    p_trip_ends_at
  )
  RETURNING * INTO v_existing;

  IF v_booking.status = 'chat_open' THEN
    UPDATE public.bookings
       SET status = 'agreement_drafting'
     WHERE id = p_booking_id;
  END IF;

  RETURN NEXT v_existing;
END;
$$;

REVOKE ALL ON FUNCTION public.create_agreement_draft_tx(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.create_agreement_draft_tx(uuid, timestamptz, timestamptz)
  TO authenticated;

-- A guide can edit only business terms on their own draft. Rates, lifecycle
-- status, signatures, and snapshots are immutable from the client.
DROP POLICY IF EXISTS "agreements_update_buddy" ON public.agreements;
CREATE POLICY "agreements_update_buddy" ON public.agreements
  FOR UPDATE
  TO authenticated
  USING (
    drafted_by_user_id = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (
    drafted_by_user_id = auth.uid()
    AND status = 'draft'
  );

REVOKE ALL ON public.agreements FROM anon;
REVOKE ALL ON public.agreements FROM authenticated;
GRANT SELECT ON public.agreements TO authenticated;
GRANT UPDATE (
  buddy_fee_paise,
  itinerary_fund_paise,
  buffer_paise,
  trip_starts_at,
  trip_ends_at
) ON public.agreements TO authenticated;

CREATE OR REPLACE FUNCTION public.recompute_agreement_draft_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_buddy_traveler_view_paise integer;
BEGIN
  IF OLD.status <> 'draft' OR NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'signed_agreement_terms_immutable';
  END IF;

  v_buddy_traveler_view_paise :=
    round(NEW.buddy_fee_paise * (1 + OLD.platform_fee_up_rate))::integer;

  NEW.gst_rate := OLD.gst_rate;
  NEW.platform_fee_up_rate := OLD.platform_fee_up_rate;
  NEW.platform_fee_down_rate := OLD.platform_fee_down_rate;
  NEW.tds_rate := OLD.tds_rate;
  NEW.traveler_subtotal_paise :=
    v_buddy_traveler_view_paise
    + NEW.itinerary_fund_paise
    + NEW.buffer_paise;
  NEW.traveler_gst_paise :=
    round(NEW.traveler_subtotal_paise * OLD.gst_rate)::integer;
  NEW.traveler_total_paise :=
    NEW.traveler_subtotal_paise + NEW.traveler_gst_paise + 50000;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_agreement_draft_snapshot
  ON public.agreements;
CREATE TRIGGER trg_recompute_agreement_draft_snapshot
  BEFORE UPDATE OF
    buddy_fee_paise,
    itinerary_fund_paise,
    buffer_paise,
    trip_starts_at,
    trip_ends_at
  ON public.agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_agreement_draft_snapshot();

-- Replace-cost-items uses DELETE + INSERT in the mobile client. Permit both
-- only while the caller still owns an editable draft.
DROP POLICY IF EXISTS "line_items_write_buddy" ON public.cost_line_items;
CREATE POLICY "line_items_insert_buddy_draft" ON public.cost_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.agreements a
       WHERE a.id = agreement_id
         AND a.drafted_by_user_id = auth.uid()
         AND a.status = 'draft'
    )
  );

DROP POLICY IF EXISTS "line_items_delete_buddy_draft" ON public.cost_line_items;
CREATE POLICY "line_items_delete_buddy_draft" ON public.cost_line_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.agreements a
       WHERE a.id = agreement_id
         AND a.drafted_by_user_id = auth.uid()
         AND a.status = 'draft'
    )
  );

REVOKE ALL ON public.cost_line_items FROM anon;
REVOKE ALL ON public.cost_line_items FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.cost_line_items TO authenticated;

CREATE OR REPLACE FUNCTION public.send_agreement_tx(p_agreement_id uuid)
RETURNS SETOF public.agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid                         uuid := auth.uid();
  v_agreement                   public.agreements%ROWTYPE;
  v_booking                     public.bookings%ROWTYPE;
  v_buddy_traveler_view_paise   integer;
  v_traveler_subtotal_paise     integer;
  v_traveler_gst_paise          integer;
  v_traveler_total_paise        integer;
BEGIN
  IF v_uid IS NULL OR EXISTS (
    SELECT 1 FROM public.users
     WHERE id = v_uid AND deletion_pending_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'agreement_send_forbidden';
  END IF;

  SELECT *
    INTO v_agreement
    FROM public.agreements
   WHERE id = p_agreement_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agreement_not_found';
  END IF;

  SELECT *
    INTO v_booking
    FROM public.bookings
   WHERE id = v_agreement.booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found';
  END IF;

  IF v_uid IS NULL
     OR v_uid <> v_booking.guide_id
     OR v_uid <> v_agreement.drafted_by_user_id THEN
    RAISE EXCEPTION 'agreement_send_forbidden';
  END IF;

  -- A network retry after the transaction committed is safe and idempotent.
  IF v_agreement.status = 'sent'
     AND v_booking.status = 'agreement_sent' THEN
    RETURN QUERY
      SELECT * FROM public.agreements WHERE id = p_agreement_id;
    RETURN;
  END IF;

  IF v_agreement.status <> 'draft' THEN
    RAISE EXCEPTION 'agreement_not_draft';
  END IF;

  IF v_booking.status <> 'agreement_drafting' THEN
    RAISE EXCEPTION 'booking_not_in_agreement_drafting';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.cost_line_items
     WHERE agreement_id = p_agreement_id
  ) THEN
    RAISE EXCEPTION 'agreement_has_no_line_items';
  END IF;

  IF v_agreement.buddy_fee_paise <= 0 THEN
    RAISE EXCEPTION 'buddy_fee_required';
  END IF;

  IF v_agreement.itinerary_fund_paise <= 0 THEN
    RAISE EXCEPTION 'itinerary_fund_required';
  END IF;

  IF v_agreement.trip_starts_at < now() + interval '4 hours' THEN
    RAISE EXCEPTION 'trip_too_soon';
  END IF;

  -- Mirrors apps/mobile/lib/booking/agreementSnapshot.ts using positive,
  -- integer-paise math.
  v_buddy_traveler_view_paise :=
    round(v_agreement.buddy_fee_paise * (1 + v_agreement.platform_fee_up_rate))::integer;
  v_traveler_subtotal_paise :=
    v_buddy_traveler_view_paise
    + v_agreement.itinerary_fund_paise
    + v_agreement.buffer_paise;
  v_traveler_gst_paise :=
    round(v_traveler_subtotal_paise * v_agreement.gst_rate)::integer;
  v_traveler_total_paise :=
    v_traveler_subtotal_paise + v_traveler_gst_paise + 50000;

  UPDATE public.agreements
     SET status                   = 'sent',
         sent_at                  = now(),
         traveler_subtotal_paise  = v_traveler_subtotal_paise,
         traveler_gst_paise       = v_traveler_gst_paise,
         traveler_total_paise     = v_traveler_total_paise,
         updated_at               = now()
   WHERE id = p_agreement_id;

  UPDATE public.bookings
     SET status              = 'agreement_sent',
         buddy_cost          = v_agreement.buddy_fee_paise / 100.0,
         estimated_expenses  =
           (v_agreement.itinerary_fund_paise + v_agreement.buffer_paise) / 100.0,
         platform_fee        =
           (v_buddy_traveler_view_paise - v_agreement.buddy_fee_paise) / 100.0,
         gst_amount          = v_traveler_gst_paise / 100.0,
         total_amount        = v_traveler_total_paise / 100.0,
         tour_start_time     = v_agreement.trip_starts_at,
         tour_end_time       = v_agreement.trip_ends_at
   WHERE id = v_agreement.booking_id;

  RETURN QUERY
    SELECT * FROM public.agreements WHERE id = p_agreement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_agreement_tx(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_agreement_tx(uuid)
  TO authenticated;
