-- Party reports and operations adjudication. No automatic ban on an allegation.
CREATE TABLE public.booking_support_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.bookings(id),
 reporter_id uuid NOT NULL REFERENCES public.users(id),
 kind text NOT NULL CHECK(kind IN ('no_show','dispute')),
 reported_party text CHECK(reported_party IN ('traveler','buddy')),
 previous_status public.booking_status NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 4 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 resolution jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz
);
CREATE UNIQUE INDEX booking_support_one_open ON public.booking_support_cases(booking_id) WHERE status='open';
ALTER TABLE public.booking_support_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_support_party_read ON public.booking_support_cases FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=booking_id AND auth.uid() IN(b.traveler_id,b.guide_id)));
GRANT SELECT ON public.booking_support_cases TO authenticated;
GRANT ALL ON public.booking_support_cases TO service_role;

CREATE FUNCTION public.report_booking_support_tx(p_booking_id uuid,p_actor_id uuid,p_kind text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings%ROWTYPE; c public.booking_support_cases%ROWTYPE; start_at timestamptz;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;
 IF p_actor_id IS NULL OR (p_actor_id IS DISTINCT FROM b.traveler_id AND p_actor_id IS DISTINCT FROM b.guide_id) THEN RAISE EXCEPTION 'not_booking_party'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN('no_show','dispute') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 4 AND 2000 THEN RAISE EXCEPTION 'invalid_support_report'; END IF;
 SELECT * INTO c FROM public.booking_support_cases WHERE booking_id=b.id AND status='open';
 IF FOUND THEN RETURN to_jsonb(c); END IF;
 IF p_kind='no_show' THEN
   SELECT trip_starts_at INTO start_at FROM public.agreements WHERE booking_id=b.id ORDER BY created_at DESC LIMIT 1;
   start_at:=coalesce(start_at,b.tour_start_time);
   IF b.status<>'trip_ready' OR start_at IS NULL OR now()<start_at+interval '2 hours' THEN RAISE EXCEPTION 'no_show_grace_period'; END IF;
 ELSE
   IF b.status NOT IN('in_progress','awaiting_proofs','reconciling','completed','rated') THEN RAISE EXCEPTION 'dispute_not_available'; END IF;
   -- TODO(Gaurav): confirm seven days before launch; matched by the shared UI constant.
   IF b.status IN('completed','rated') AND (b.reconciled_at IS NULL OR now()>b.reconciled_at+interval '7 days') THEN RAISE EXCEPTION 'dispute_window_closed'; END IF;
 END IF;
 INSERT INTO public.booking_support_cases(booking_id,reporter_id,kind,reported_party,previous_status,reason)
 VALUES(b.id,p_actor_id,p_kind,CASE WHEN p_kind='no_show' THEN CASE WHEN p_actor_id=b.traveler_id THEN 'buddy' ELSE 'traveler' END END,b.status,btrim(p_reason)) RETURNING * INTO c;
 UPDATE public.bookings SET status='disputed' WHERE id=b.id;
 RETURN to_jsonb(c);
END $$;
REVOKE ALL ON FUNCTION public.report_booking_support_tx(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_booking_support_tx(uuid,uuid,text,text) TO service_role;

CREATE FUNCTION public.admin_resolve_support_tx(p_actor_id uuid,p_actor_role public.admin_role,p_booking_id uuid,p_resolution text,p_reason text,p_idempotency_key text,p_refund_percent integer DEFAULT NULL,p_request_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings%ROWTYPE; c public.booking_support_cases%ROWTYPE; prior jsonb; result jsonb; audit_id uuid;
 total_net bigint; refund_net bigint; buddy_net bigint; target_status public.booking_status;
BEGIN
 PERFORM public.assert_admin_actor(p_actor_id,p_actor_role,ARRAY['owner','operations']::public.admin_role[]);
 PERFORM public.validate_admin_command_fields(p_reason,p_idempotency_key);
 SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;
 prior:=public.admin_idempotent_result(p_actor_id,'lifecycle.resolve','booking',p_booking_id::text,p_idempotency_key);
 IF prior IS NOT NULL THEN RETURN prior; END IF;
 IF b.status<>'disputed' THEN RAISE EXCEPTION 'booking_not_disputed'; END IF;
 SELECT * INTO c FROM public.booking_support_cases WHERE booking_id=b.id AND status='open' FOR UPDATE;
 IF p_resolution='confirm_no_show' THEN
   IF c.id IS NULL OR c.kind<>'no_show' THEN RAISE EXCEPTION 'no_show_report_required'; END IF;
   UPDATE public.bookings SET status='trip_ready' WHERE id=b.id;
   result:=public.compute_cancellation_resolution_tx(b.id,'no_show_'||c.reported_party,'platform');
 ELSIF p_resolution IN('dismiss','resume_reconciliation') THEN
   target_status:=coalesce(c.previous_status,'reconciling'::public.booking_status);
   UPDATE public.bookings SET status=target_status WHERE id=b.id;
   result:=jsonb_build_object('status',target_status,'resolution',p_resolution);
 ELSIF p_resolution='cancel_force_majeure' THEN
   IF b.reconciled_at IS NOT NULL THEN RAISE EXCEPTION 'use_remaining_settlement'; END IF;
   IF c.previous_status IN('in_progress','awaiting_proofs','reconciling') OR EXISTS(SELECT 1 FROM public.payout_dispatches WHERE booking_id=b.id AND kind='trip_pot_release') THEN RAISE EXCEPTION 'reconciliation_required'; END IF;
   UPDATE public.bookings SET status=coalesce(c.previous_status,'trip_ready'::public.booking_status) WHERE id=b.id;
   result:=public.compute_cancellation_resolution_tx(b.id,'force_majeure_verified','platform');
 ELSIF p_resolution IN('refund','release','split') THEN
   -- Only adjudicate an established settlement. Never invent funds or claw back a sent payout.
   IF b.reconciled_at IS NULL THEN RAISE EXCEPTION 'reconciliation_required'; END IF;
   PERFORM 1 FROM public.payout_dispatches WHERE booking_id=b.id ORDER BY id FOR UPDATE;
   IF p_resolution='release' THEN
     result:=jsonb_build_object('resolution','release','note','Existing signed settlement remains unchanged');
   ELSE
     IF p_resolution='refund' THEN p_refund_percent:=100; END IF;
     IF p_refund_percent IS NULL OR p_refund_percent<0 OR p_refund_percent>100 THEN RAISE EXCEPTION 'invalid_refund_percent'; END IF;
     SELECT coalesce(sum(net_paise),0) INTO total_net FROM public.payout_dispatches
       WHERE booking_id=b.id AND kind IN('buddy_fee_final','traveler_refund') AND status IN('pending','failed');
     IF (SELECT count(*) FROM public.payout_dispatches WHERE booking_id=b.id AND kind IN('buddy_fee_final','traveler_refund') AND status IN('pending','failed'))<>2 THEN RAISE EXCEPTION 'settlement_already_dispatched'; END IF;
     IF total_net<=0 THEN RAISE EXCEPTION 'no_unpaid_settlement'; END IF;
     -- Do not overwrite a sent standard payout or refund; that needs a separately funded adjustment.
     IF EXISTS(SELECT 1 FROM public.payout_dispatches WHERE booking_id=b.id AND kind IN('buddy_fee_final','traveler_refund') AND status='sent') THEN RAISE EXCEPTION 'settlement_already_dispatched'; END IF;
     IF EXISTS(SELECT 1 FROM public.refund_payment_allocations a JOIN public.payout_dispatches d ON d.id=a.dispatch_id WHERE d.booking_id=b.id AND d.kind IN('buddy_fee_final','traveler_refund') AND a.status='sent') THEN RAISE EXCEPTION 'settlement_already_dispatched'; END IF;
     DELETE FROM public.refund_payment_allocations a USING public.payout_dispatches d WHERE a.dispatch_id=d.id AND d.booking_id=b.id AND d.kind IN('buddy_fee_final','traveler_refund') AND a.status='pending';
     refund_net:=floor(total_net*p_refund_percent/100); buddy_net:=total_net-refund_net;
     UPDATE public.payout_dispatches SET net_paise=CASE WHEN kind='traveler_refund' THEN refund_net ELSE buddy_net END,
       gross_paise=greatest(gross_paise,CASE WHEN kind='traveler_refund' THEN refund_net ELSE buddy_net END),status='pending',failed_reason=NULL
       WHERE booking_id=b.id AND kind IN('buddy_fee_final','traveler_refund') AND status IN('pending','failed');
     result:=jsonb_build_object('resolution',p_resolution,'remaining_net_paise',total_net,'traveler_refund_paise',refund_net,'buddy_net_paise',buddy_net,'refund_percent',p_refund_percent);
   END IF;
   UPDATE public.bookings SET status='completed' WHERE id=b.id;
 ELSE RAISE EXCEPTION 'invalid_dispute_resolution'; END IF;
 UPDATE public.booking_support_cases SET status='resolved',resolved_at=now(),resolution=result||jsonb_build_object('reason',btrim(p_reason)) WHERE id=c.id;
 INSERT INTO public.admin_action_log(actor_id,actor_role,action,target_type,target_id,reason,before_state,after_state,idempotency_key,request_id,metadata)
 VALUES(p_actor_id,p_actor_role,'lifecycle.resolve','booking',b.id::text,btrim(p_reason),jsonb_build_object('status',b.status),result,p_idempotency_key,p_request_id,jsonb_build_object('case_id',c.id)) RETURNING id INTO audit_id;
 RETURN jsonb_build_object('idempotent',false,'audit_id',audit_id,'result',result);
END $$;
REVOKE ALL ON FUNCTION public.admin_resolve_support_tx(uuid,public.admin_role,uuid,text,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_support_tx(uuid,public.admin_role,uuid,text,text,text,integer,text) TO service_role;
