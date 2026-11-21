// ============================================================================
// CREATE-BALANCE-ORDER — Phase 3 Edge Function
// ============================================================================
// Creates a Razorpay order for the trip balance (traveler_subtotal + GST +
// optional late fee) and records the matching payment_events row.
//
// Inputs (POST JSON body):
//   { booking_id: uuid }
// Auth: Bearer JWT. Caller must be the booking's traveler.
//
// Returns:
//   { order_id, amount_paise, currency, key_id, payment_event_id, reused? }
//
// Reuse the existing Razorpay order for the booking when its amount matches
// the current quote, including after a failed checkout attempt.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';
import { createOrder, idempotencyKey } from '../_shared/razorpayClient.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  // ── Authn ────────────────────────────────────────────────────────────────
  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  // ── Body ─────────────────────────────────────────────────────────────────
  let body: { booking_id: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 400);
  }
  if (typeof body?.booking_id !== 'string' || !body.booking_id) return errorResponse('booking_id required', 400);

  const db = adminClient();

  // ── Load booking ─────────────────────────────────────────────────────────
  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('id, traveler_id, status, late_fee_paise')
    .eq('id', body.booking_id)
    .single();

  if (bErr || !booking) return errorResponse('booking_not_found', 404);

  // ── Authz: must be traveler ───────────────────────────────────────────────
  if (booking.traveler_id !== caller.userId) {
    return errorResponse('forbidden', 403);
  }

  // ── Guard: only valid from awaiting_balance or late_fee_due ──────────────
  if (booking.status !== 'awaiting_balance' && booking.status !== 'late_fee_due') {
    return errorResponse(`booking_status_not_payable:${booking.status}`, 409);
  }

  const isLateFee = booking.status === 'late_fee_due';

  // ── Load latest agreement for amount computation ──────────────────────────
  const { data: agreement, error: aErr } = await db
    .from('agreements')
    .select('traveler_subtotal_paise, traveler_gst_paise, trip_starts_at')
    .eq('booking_id', body.booking_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (aErr || !agreement) {
    return errorResponse('agreement_not_found', 409);
  }

  // Balance = subtotal + GST (deposit already paid; not charged again).
  // The booking stores the fee assessed by the lifecycle job, including zero.
  const balanceAmount = agreement.traveler_subtotal_paise +
                        agreement.traveler_gst_paise +
                        (isLateFee ? booking.late_fee_paise : 0);

  // A failed payment attempt leaves the provider order available for retries.
  const { data: existingPe, error: peCheckErr } = await db
    .from('payment_events')
    .select('id, razorpay_order_id, status, amount_paise')
    .eq('booking_id', body.booking_id)
    .eq('kind', 'balance')
    .maybeSingle();

  if (peCheckErr) return errorResponse('payment_event_lookup_failed', 503);
  if (existingPe) {
    if (existingPe.status !== 'initiated' && existingPe.status !== 'failed') {
      return errorResponse('balance_already_processed', 409);
    }
    if (!existingPe.razorpay_order_id) return errorResponse('balance_order_unavailable', 503);
    if (existingPe.amount_paise !== balanceAmount) return errorResponse('balance_order_amount_changed', 409);
    return jsonResponse({
      order_id:         existingPe.razorpay_order_id,
      amount_paise:     existingPe.amount_paise,
      currency:         'INR',
      key_id:           Deno.env.get('RAZORPAY_KEY_ID'),
      payment_event_id: existingPe.id,
      reused:           true,
      trip_starts_at:   agreement.trip_starts_at,
    });
  }

  // ── Build deterministic idempotency key ──────────────────────────────────
  const iKey = await idempotencyKey([
    'balance_order', body.booking_id, String(isLateFee),
  ]);

  // ── Create Razorpay order ─────────────────────────────────────────────────
  let order: { order_id: string; amount: number; currency: string };
  try {
    const result = await createOrder({
      amount_paise: balanceAmount,
      currency:     'INR',
      receipt:      `bal_${body.booking_id.slice(0, 32)}`,
      notes: {
        booking_id:            body.booking_id,
        kind:                  'balance',
        is_late_fee_component: String(isLateFee),
      },
    });
    order = { order_id: result.order_id, amount: result.amount, currency: result.currency };
  } catch {
    console.error('Razorpay balance order request failed');
    return errorResponse('razorpay_order_failed', 502);
  }

  // ── Insert payment_events row ─────────────────────────────────────────────
  const { data: pe, error: peErr } = await db
    .from('payment_events')
    .insert({
      booking_id:            body.booking_id,
      user_id:               caller.userId,
      kind:                  'balance',
      amount_paise:          balanceAmount,
      status:                'initiated',
      razorpay_order_id:     order.order_id,
      is_late_fee_component: isLateFee,
      idempotency_key:       iKey,
    })
    .select('id')
    .single();

  if (peErr || !pe) return errorResponse('payment_event_insert_failed', 503);

  return jsonResponse({
    order_id:         order.order_id,
    amount_paise:     order.amount,
    currency:         order.currency,
    key_id:           Deno.env.get('RAZORPAY_KEY_ID'),
    payment_event_id: pe.id,
    reused:           false,
    trip_starts_at:   agreement.trip_starts_at,
  });
});
