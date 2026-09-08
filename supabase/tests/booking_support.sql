-- Run against an isolated, migrated, seeded database; rolls all fixtures back.
BEGIN;
DO $$
DECLARE b uuid:=gen_random_uuid(); traveler uuid:='aaaaaaaa-0000-4000-a000-000000000011'; buddy uuid:='aaaaaaaa-0000-4000-a000-000000000001'; owner_id uuid:='aaaaaaaa-0000-4000-a000-000000000099'; report jsonb; result jsonb; replay jsonb; d uuid; total bigint;
BEGIN
 INSERT INTO public.bookings SELECT (jsonb_populate_record(NULL::public.bookings,to_jsonb(src)||jsonb_build_object('id',b,'traveler_id',traveler,'guide_id',buddy,'status','trip_ready','tour_start_time',now()-interval '3 hours','cancelled_resolution_jsonb',NULL,'reconciled_at',NULL))).* FROM public.bookings src LIMIT 1;
 ASSERT NOT has_function_privilege('authenticated','public.report_booking_support_tx(uuid,uuid,text,text)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.admin_resolve_support_tx(uuid,public.admin_role,uuid,text,text,text,integer,text)','EXECUTE');
 BEGIN PERFORM public.report_booking_support_tx(b,owner_id,'no_show','Not present'); RAISE EXCEPTION 'expected auth rejection'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'not_booking_party' THEN RAISE; END IF; END;
 UPDATE public.bookings SET tour_start_time=now() WHERE id=b;
 BEGIN PERFORM public.report_booking_support_tx(b,traveler,'no_show','Not present'); RAISE EXCEPTION 'expected grace rejection'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'no_show_grace_period' THEN RAISE; END IF; END;
 UPDATE public.bookings SET tour_start_time=now()-interval '3 hours' WHERE id=b;
 report:=public.report_booking_support_tx(b,traveler,'no_show','Buddy has not arrived');
 ASSERT report->>'reported_party'='buddy';
 ASSERT (SELECT status='disputed' FROM public.bookings WHERE id=b);
 ASSERT (SELECT NOT is_banned FROM public.users WHERE id=buddy);
 ASSERT public.report_booking_support_tx(b,traveler,'no_show','Retry report')->>'id'=report->>'id';
 result:=public.admin_resolve_support_tx(owner_id,'owner',b,'confirm_no_show','Verified the meeting records','test-no-show-0001');
 ASSERT (SELECT status='no_show_buddy' FROM public.bookings WHERE id=b);
 ASSERT (SELECT is_banned FROM public.users WHERE id=buddy);
 replay:=public.admin_resolve_support_tx(owner_id,'owner',b,'confirm_no_show','Verified the meeting records','test-no-show-0001');
 ASSERT replay->>'idempotent'='true';
 ASSERT (SELECT count(*)=1 FROM public.admin_action_log WHERE target_id=b::text AND action='lifecycle.resolve');
 -- Post-completion deadline and controlled reopening, with preserved net funds.
 UPDATE public.bookings SET status='completed',reconciled_at=now()-interval '8 days',cancelled_resolution_jsonb=NULL WHERE id=b;
 BEGIN PERFORM public.report_booking_support_tx(b,traveler,'dispute','Incorrect final amount'); RAISE EXCEPTION 'expected deadline rejection'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'dispute_window_closed' THEN RAISE; END IF; END;
 UPDATE public.bookings SET reconciled_at=now() WHERE id=b;
 INSERT INTO public.payout_dispatches(booking_id,kind,recipient_user_id,gross_paise,net_paise) VALUES(b,'buddy_fee_final',buddy,150000,150000),(b,'traveler_refund',traveler,50000,50000);
 SELECT id INTO d FROM public.payout_dispatches WHERE booking_id=b AND kind='buddy_fee_final';
 UPDATE public.payout_dispatches SET failed_reason='razorpay_live_not_configured' WHERE id=d;
 ASSERT public.claim_booking_dispatch_tx(d);
 ASSERT (SELECT failed_reason IS NULL FROM public.payout_dispatches WHERE id=d);
 BEGIN PERFORM public.report_booking_support_tx(b,traveler,'dispute','Incorrect final amount'); RAISE EXCEPTION 'expected in-flight rejection'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'payment_in_progress' THEN RAISE; END IF; END;
 UPDATE public.payout_dispatches SET dispatch_claimed_at=NULL WHERE id=d;
 PERFORM public.report_booking_support_tx(b,traveler,'dispute','Incorrect final amount');
 ASSERT NOT public.claim_booking_dispatch_tx(d);
 result:=public.admin_resolve_support_tx(owner_id,'owner',b,'split','Agreed settlement after evidence review','test-split-0001',30);
 ASSERT (result->'result'->>'traveler_refund_paise')::bigint=60000;
 SELECT sum(net_paise) INTO total FROM public.payout_dispatches WHERE booking_id=b AND kind IN('buddy_fee_final','traveler_refund');
 ASSERT total=200000;
 ASSERT (SELECT status='completed' FROM public.bookings WHERE id=b);
 -- A sent settlement must never be silently rewritten/refunded again.
 PERFORM public.report_booking_support_tx(b,traveler,'dispute','Additional evidence supplied');
 UPDATE public.payout_dispatches SET status='sent' WHERE id=d;
 BEGIN PERFORM public.admin_resolve_support_tx(owner_id,'owner',b,'refund','Requested revised outcome','test-refund-0001'); RAISE EXCEPTION 'expected sent rejection'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'settlement_already_dispatched' THEN RAISE; END IF; END;
 PERFORM public.admin_resolve_support_tx(owner_id,'owner',b,'release','Existing paid outcome remains valid','test-release-0001');
 ASSERT (SELECT status='completed' FROM public.bookings WHERE id=b);
 -- A trip already underway must settle expenses rather than refund a released pot.
 UPDATE public.bookings SET status='in_progress',reconciled_at=NULL WHERE id=b;
 PERFORM public.report_booking_support_tx(b,traveler,'dispute','Trip interrupted after starting');
 BEGIN PERFORM public.admin_resolve_support_tx(owner_id,'owner',b,'cancel_force_majeure','Trip was interrupted','test-active-cancel-0001'); RAISE EXCEPTION 'expected reconciliation requirement'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'reconciliation_required' THEN RAISE; END IF; END;
 PERFORM public.admin_resolve_support_tx(owner_id,'owner',b,'dismiss','Resume to collect expense proofs','test-active-dismiss-0001');
 ASSERT (SELECT status='in_progress' FROM public.bookings WHERE id=b);
 -- The existing recovery sweep needs both deposits, not merely the status label.
 UPDATE public.bookings SET status='deposits_held',updated_at=now()-interval '5 minutes' WHERE id=b;
 INSERT INTO public.deposits(booking_id,user_id,side,status) VALUES(b,traveler,'traveler','held');
 -- Timestamp update trigger uses now(); disable it only for this rollback-only fixture.
 ALTER TABLE public.bookings DISABLE TRIGGER USER;
 UPDATE public.bookings SET updated_at=now()-interval '5 minutes' WHERE id=b;
 ALTER TABLE public.bookings ENABLE TRIGGER USER;
 PERFORM public.cron_deposits_held_sweep();
 ASSERT (SELECT status='deposits_held' FROM public.bookings WHERE id=b);
 INSERT INTO public.deposits(booking_id,user_id,side,status) VALUES(b,buddy,'buddy','held');
 PERFORM public.cron_deposits_held_sweep();
 ASSERT (SELECT status='awaiting_balance' FROM public.bookings WHERE id=b);
 RAISE NOTICE 'booking support authorization, grace, idempotency, deadlines, dispatch exclusion and conservation passed';
END $$;
ROLLBACK;
