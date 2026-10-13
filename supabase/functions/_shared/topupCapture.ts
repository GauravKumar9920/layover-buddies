// TOP-UP CAPTURE — top-ups affect reconciliation, never booking.status.
// The ledger is created before checkout is offered. A missing ledger or failed
// dependent write requests a webhook retry instead of acknowledging lost money.

export interface TopUpCapturePayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  amount_paise: number;
  booking_id: string;
  top_up_request_id: string;
}

export interface TopUpCaptureOutcome {
  ok: boolean;
  idempotent?: boolean;
  payment_event_id?: string;
}

export async function handleTopUpCaptured(
  db: { from(table: string): any },
  payload: TopUpCapturePayload,
): Promise<TopUpCaptureOutcome> {
  const { razorpay_payment_id, razorpay_order_id, amount_paise, booking_id, top_up_request_id } = payload;
  const { data: existing, error: readError } = await db.from('payment_events')
    .select('id,status,booking_id,kind,amount_paise,razorpay_payment_id')
    .eq('razorpay_order_id', razorpay_order_id).maybeSingle();
  if (readError || !existing) throw new Error('topup payment ledger unavailable');
  if (existing.booking_id !== booking_id || existing.kind !== 'top_up'
    || existing.amount_paise !== amount_paise || !Number.isSafeInteger(amount_paise) || amount_paise <= 0) {
    throw new Error('topup capture does not match the recorded order');
  }
  if (existing.status === 'refunded') return { ok: true, idempotent: true, payment_event_id: existing.id };

  const alreadyCaptured = existing.status === 'captured';
  if (alreadyCaptured && existing.razorpay_payment_id !== razorpay_payment_id) {
    throw new Error('topup order already has a different captured payment');
  }
  if (!alreadyCaptured) {
    const { data: captured, error } = await db.from('payment_events').update({
      status: 'captured', razorpay_payment_id, failed_reason: null, captured_at: new Date().toISOString(),
    }).eq('id', existing.id).in('status', ['initiated', 'failed']).select('id').maybeSingle();
    if (error || !captured) throw new Error('topup capture ledger write failed');
  }

  // A previous invocation may have recorded the capture then failed here.
  // Complete this step even when the ledger already records the payment.
  const { data: request, error: requestError } = await db.from('top_up_requests').update({
    status: 'captured', payment_event_id: existing.id, razorpay_payment_id,
  }).eq('id', top_up_request_id).eq('booking_id', booking_id)
    .in('status', ['approved', 'pending']).select('id').maybeSingle();
  if (requestError) throw new Error('topup request capture write failed');
  if (!request) {
    const { data: completed, error } = await db.from('top_up_requests').select('status,payment_event_id')
      .eq('id', top_up_request_id).eq('booking_id', booking_id).maybeSingle();
    if (error || completed?.status !== 'captured' || completed.payment_event_id !== existing.id) {
      throw new Error('topup request is not captured');
    }
  }
  return { ok: true, ...(alreadyCaptured ? { idempotent: true } : {}), payment_event_id: existing.id };
}
