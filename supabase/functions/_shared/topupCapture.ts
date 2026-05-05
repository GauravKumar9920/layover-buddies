// ============================================================================
// TOP-UP CAPTURE — Phase 4 shared handler
// ============================================================================
// Called by razorpay-webhook when notes.kind === 'top_up' and the payment
// is captured. Does NOT change the booking status — top-ups are invisible
// to the state machine. They only affect reconciliation math via the
// payment_events aggregation in compute_reconciliation_tx.
//
// Idempotent: re-running on the same razorpay_payment_id is a no-op.
// ============================================================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export interface TopUpCapturePayload {
  razorpay_payment_id: string;
  razorpay_order_id:   string;
  amount_paise:        number;
  booking_id:          string;
  top_up_request_id:   string;
}

export interface TopUpCaptureOutcome {
  ok:            boolean;
  idempotent?:   boolean;
  payment_event_id?: string;
}

export async function handleTopUpCaptured(
  db: SupabaseClient,
  payload: TopUpCapturePayload,
): Promise<TopUpCaptureOutcome> {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    amount_paise,
    booking_id,
    top_up_request_id,
  } = payload;

  // ── 1. Idempotency check ────────────────────────────────────────────────────
  const { data: existing } = await db
    .from('payment_events')
    .select('id')
    .eq('razorpay_payment_id', razorpay_payment_id)
    .eq('status', 'captured')
    .maybeSingle();

  if (existing) {
    return { ok: true, idempotent: true, payment_event_id: existing.id };
  }

  // ── 2. Mark payment_events row as captured ──────────────────────────────────
  // Match on razorpay_order_id (set when the order was created).
  const { data: updatedEvent, error: updErr } = await db
    .from('payment_events')
    .update({
      status:              'captured',
      razorpay_payment_id,
      captured_at:         new Date().toISOString(),
    })
    .eq('razorpay_order_id', razorpay_order_id)
    .eq('status', 'initiated')
    .select('id')
    .single();

  if (updErr || !updatedEvent) {
    // Row might not exist yet if webhook arrived before Edge fn response.
    // Insert it directly so we never lose a captured payment.
    const { data: inserted, error: insErr } = await db
      .from('payment_events')
      .insert({
        booking_id,
        kind:                'top_up',
        status:              'captured',
        amount_paise,
        razorpay_order_id,
        razorpay_payment_id,
        captured_at:         new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insErr) throw new Error(`topup capture insert failed: ${insErr.message}`);
    return { ok: true, payment_event_id: inserted.id };
  }

  // ── 3. Flip top_up_requests.status to 'captured' ────────────────────────────
  await db
    .from('top_up_requests')
    .update({
      status:           'captured',
      payment_event_id: updatedEvent.id,
    })
    .eq('id', top_up_request_id)
    .in('status', ['approved', 'pending']); // idempotent — won't flip captured→captured

  return { ok: true, payment_event_id: updatedEvent.id };
}
