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
// Idempotent: re-uses an existing 'initiated' payment_events row of kind
// 'balance' with the same is_late_fee_component flag rather than creating a
// second Razorpay order.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';
import { createOrder, idempotencyKey } from '../_shared/razorpayClient.ts';

const LATE_FEE_PAISE = 100_000;  // ₹1,000 — mirrors apps/mobile/config/constants.ts

serve(async (req: Request) => {
  console.log('[create-balance-order] Request received:', req.method, req.url);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  // ── Authn ────────────────────────────────────────────────────────────────
  console.log('[create-balance-order] Extracting caller identity...');
  const caller = await getUserFromRequest(req);
  console.log('[create-balance-order] Caller identity:', caller);
  if (!caller) return errorResponse('unauthorized', 401);

  // ── Body ─────────────────────────────────────────────────────────────────
  let body: { booking_id: string };
  try {
    body = await req.json();
    console.log('[create-balance-order] Request body:', body);
  } catch (e) {
    console.error('[create-balance-order] Failed to parse JSON body:', e);
    return errorResponse('invalid_json', 400);
  }
  if (!body.booking_id) return errorResponse('booking_id required', 400);

  const db = adminClient();

  // ── Load booking ─────────────────────────────────────────────────────────
  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('id, traveler_id, guide_id, status, late_fee_paise')
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
    .select('id, traveler_subtotal_paise, traveler_gst_paise, traveler_total_paise, trip_starts_at')
    .eq('booking_id', body.booking_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (aErr || !agreement) {
    return errorResponse('agreement_not_found', 409);
  }

  // Balance = subtotal + GST (deposit already paid; not charged again).
  // If late_fee_due, add ₹1,000 late fee.
  const balanceAmount = agreement.traveler_subtotal_paise +
                        agreement.traveler_gst_paise +
                        (isLateFee ? LATE_FEE_PAISE : 0);

  // ── Idempotency: re-use existing initiated row ────────────────────────────
  console.log('[create-balance-order] Checking existing payment event for booking_id:', body.booking_id, 'isLateFee:', isLateFee);
  const { data: existingPe, error: peCheckErr } = await db
    .from('payment_events')
    .select('id, razorpay_order_id, status')
    .eq('booking_id', body.booking_id)
    .eq('kind', 'balance')
    .eq('status', 'initiated')
    .eq('is_late_fee_component', isLateFee)
    .maybeSingle();

  if (peCheckErr) {
    console.error('[create-balance-order] Existing payment check DB error:', peCheckErr);
  }

  console.log('[create-balance-order] Existing payment event found:', existingPe);

  if (existingPe?.razorpay_order_id) {
    console.log('[create-balance-order] Re-using existing initiated payment event:', existingPe.razorpay_order_id);
    return jsonResponse({
      order_id:         existingPe.razorpay_order_id,
      amount_paise:     balanceAmount,
      currency:         'INR',
      key_id:           Deno.env.get('RAZORPAY_KEY_ID'),
      payment_event_id: existingPe.id,
      reused:           true,
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
  } catch (err) {
    console.error('Razorpay createOrder error:', err);
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

  if (peErr) {
    return errorResponse(`db_error: ${peErr.message}`, 500);
  }

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
