BEGIN;
DO $$
DECLARE b uuid:=gen_random_uuid(); d uuid; d2 uuid; t uuid:='aaaaaaaa-0000-4000-a000-000000000011'; g uuid:='aaaaaaaa-0000-4000-a000-000000000001'; allocations jsonb;
BEGIN
 INSERT INTO public.bookings SELECT (jsonb_populate_record(NULL::public.bookings,to_jsonb(src)||jsonb_build_object('id',b,'traveler_id',t,'guide_id',g,'status','completed'))).* FROM public.bookings src LIMIT 1;
 INSERT INTO public.payment_events(booking_id,user_id,kind,status,amount_paise,razorpay_payment_id) VALUES(b,g,'deposit','captured',50000,'guide-'||b),(b,t,'deposit','captured',50000,'traveler-deposit-'||b),(b,t,'balance','captured',100000,'traveler-balance-'||b);
 INSERT INTO public.payout_dispatches(booking_id,kind,recipient_user_id,gross_paise,net_paise) VALUES(b,'traveler_refund',t,120000,120000) RETURNING id INTO d;
 ASSERT public.claim_booking_dispatch_tx(d);
 allocations:=public.reserve_dispatch_refunds_tx(d);
 ASSERT jsonb_array_length(allocations)=2;
 ASSERT (SELECT sum((v->>'amount_paise')::int)=120000 FROM jsonb_array_elements(allocations) v);
 ASSERT NOT EXISTS(SELECT 1 FROM public.refund_payment_allocations a JOIN public.payment_events p ON p.id=a.payment_event_id WHERE a.dispatch_id=d AND p.user_id<>t);
 ASSERT allocations=public.reserve_dispatch_refunds_tx(d);
 INSERT INTO public.payout_dispatches(booking_id,kind,recipient_user_id,gross_paise,net_paise) VALUES(b,'buddy_fee_cancellation_refund',t,50000,50000) RETURNING id INTO d2;
 ASSERT public.claim_booking_dispatch_tx(d2);
 BEGIN PERFORM public.reserve_dispatch_refunds_tx(d2); RAISE EXCEPTION 'expected over-refund rejection'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'insufficient_refundable_capture' THEN RAISE; END IF; END;
 ASSERT NOT EXISTS(SELECT 1 FROM public.refund_payment_allocations WHERE dispatch_id=d2);
 ASSERT NOT has_function_privilege('authenticated','public.reserve_dispatch_refunds_tx(uuid)','EXECUTE');
 RAISE NOTICE 'refund payer matching, allocation conservation, retry stability and capture limits passed';
END $$;
ROLLBACK;
