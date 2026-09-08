-- Serialise support reports with money dispatch. A process with an uncertain
-- provider result retains its claim for reconciliation, never automatic expiry.
ALTER TABLE public.payout_dispatches ADD COLUMN dispatch_claimed_at timestamptz;
CREATE FUNCTION public.claim_booking_dispatch_tx(p_dispatch_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking_id_value uuid; b public.bookings%ROWTYPE; d public.payout_dispatches%ROWTYPE;
BEGIN
 SELECT booking_id INTO booking_id_value FROM public.payout_dispatches WHERE id=p_dispatch_id;
 SELECT * INTO b FROM public.bookings WHERE id=booking_id_value FOR UPDATE;
 IF NOT FOUND OR b.status='disputed' THEN RETURN false; END IF;
 SELECT * INTO d FROM public.payout_dispatches WHERE id=p_dispatch_id FOR UPDATE;
 IF d.status NOT IN('pending','failed') OR d.dispatch_claimed_at IS NOT NULL THEN RETURN false; END IF;
 UPDATE public.payout_dispatches SET dispatch_claimed_at=now(),failed_reason=NULL WHERE id=d.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_booking_dispatch_tx(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_booking_dispatch_tx(uuid) TO service_role;
-- Block case creation while an external transfer's result is not yet known.
CREATE FUNCTION public.guard_support_dispatch() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.payout_dispatches WHERE booking_id=NEW.booking_id AND dispatch_claimed_at IS NOT NULL AND status<>'sent') THEN RAISE EXCEPTION 'payment_in_progress'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER support_dispatch_guard BEFORE INSERT ON public.booking_support_cases FOR EACH ROW EXECUTE FUNCTION public.guard_support_dispatch();

-- Existing reconciliation/cancellation code must respect a newly opened case
-- even if its edge request read the booking before the case was submitted.
ALTER FUNCTION public.compute_reconciliation_tx(uuid) RENAME TO compute_reconciliation_before_support_tx;
REVOKE ALL ON FUNCTION public.compute_reconciliation_before_support_tx(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.compute_reconciliation_tx(p_booking_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
 IF b.status NOT IN('awaiting_proofs','reconciling','completed','rated') THEN RAISE EXCEPTION 'reconciliation_not_available'; END IF;
 RETURN public.compute_reconciliation_before_support_tx(p_booking_id);
END $$;
REVOKE ALL ON FUNCTION public.compute_reconciliation_tx(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.compute_reconciliation_tx(uuid) TO service_role;
ALTER FUNCTION public.compute_cancellation_resolution_tx(uuid,text,text) RENAME TO compute_cancellation_before_support_tx;
REVOKE ALL ON FUNCTION public.compute_cancellation_before_support_tx(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.compute_cancellation_resolution_tx(p_booking_id uuid,p_trigger text,p_actor text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
 IF b.cancelled_resolution_jsonb IS NOT NULL THEN RETURN b.cancelled_resolution_jsonb; END IF;
 IF b.status IN('disputed','completed','rated','in_progress','awaiting_proofs','reconciling') THEN RAISE EXCEPTION 'cancellation_not_available'; END IF;
 RETURN public.compute_cancellation_before_support_tx(p_booking_id,p_trigger,p_actor);
END $$;
REVOKE ALL ON FUNCTION public.compute_cancellation_resolution_tx(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.compute_cancellation_resolution_tx(uuid,text,text) TO service_role;
