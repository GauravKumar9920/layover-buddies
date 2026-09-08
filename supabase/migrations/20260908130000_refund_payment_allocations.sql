-- Refunds must go to the actual payer and never exceed an original capture.
CREATE TABLE public.refund_payment_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dispatch_id uuid NOT NULL REFERENCES public.payout_dispatches(id),
 payment_event_id uuid NOT NULL REFERENCES public.payment_events(id),
 amount_paise integer NOT NULL CHECK(amount_paise>0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sent')),
 razorpay_refund_id text,
 UNIQUE(dispatch_id,payment_event_id)
);
ALTER TABLE public.refund_payment_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_payment_allocations FROM anon,authenticated;
GRANT ALL ON public.refund_payment_allocations TO service_role;
CREATE FUNCTION public.reserve_dispatch_refunds_tx(p_dispatch_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.payout_dispatches%ROWTYPE; p public.payment_events%ROWTYPE; remaining integer; available integer; allocation integer;
BEGIN
 SELECT * INTO d FROM public.payout_dispatches WHERE id=p_dispatch_id FOR UPDATE;
 IF NOT FOUND OR d.dispatch_claimed_at IS NULL OR d.status NOT IN('pending','failed') THEN RAISE EXCEPTION 'refund_claim_required'; END IF;
 IF d.kind::text NOT IN('traveler_refund','traveler_deposit_refund','buddy_deposit_refund','trip_fund_cancellation_refund','buddy_fee_cancellation_refund') THEN RAISE EXCEPTION 'invalid_refund_kind'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.refund_payment_allocations WHERE dispatch_id=d.id) THEN
  IF EXISTS(SELECT 1 FROM public.payout_dispatches old WHERE old.booking_id=d.booking_id AND old.recipient_user_id=d.recipient_user_id AND old.status='sent' AND old.razorpay_refund_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.refund_payment_allocations a WHERE a.dispatch_id=old.id)) THEN RAISE EXCEPTION 'existing_refunds_need_reconciliation'; END IF;
  remaining:=d.net_paise;
  FOR p IN SELECT * FROM public.payment_events WHERE booking_id=d.booking_id AND user_id=d.recipient_user_id AND status='captured' AND razorpay_payment_id IS NOT NULL AND kind IN('balance','deposit','top_up') ORDER BY CASE WHEN kind='balance' THEN 0 ELSE 1 END,initiated_at,id FOR UPDATE LOOP
   SELECT p.amount_paise-coalesce(sum(amount_paise),0) INTO available FROM public.refund_payment_allocations WHERE payment_event_id=p.id;
   allocation:=least(remaining,greatest(available,0));
   IF allocation>0 THEN INSERT INTO public.refund_payment_allocations(dispatch_id,payment_event_id,amount_paise) VALUES(d.id,p.id,allocation); remaining:=remaining-allocation; END IF;
   EXIT WHEN remaining=0;
  END LOOP;
  IF remaining<>0 THEN RAISE EXCEPTION 'insufficient_refundable_capture'; END IF;
 END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'amount_paise',a.amount_paise,'status',a.status,'razorpay_refund_id',a.razorpay_refund_id,'payment_id',pe.razorpay_payment_id) ORDER BY a.id),'[]'::jsonb) FROM public.refund_payment_allocations a JOIN public.payment_events pe ON pe.id=a.payment_event_id WHERE a.dispatch_id=d.id);
END $$;
REVOKE ALL ON FUNCTION public.reserve_dispatch_refunds_tx(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_dispatch_refunds_tx(uuid) TO service_role;
