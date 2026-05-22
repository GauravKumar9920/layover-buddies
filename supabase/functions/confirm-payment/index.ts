// ============================================================================
// CONFIRM-PAYMENT (Phase 3 Edge Function — client-confirm fallback)
// ============================================================================
// Production-correct settlement of a Razorpay payment when the merchant
// hasn't configured a webhook (e.g. local dev, KYC pending) or when the
// webhook hasn't arrived within the app's poll window.
//
// The native Razorpay checkout SDK resolves with three signed values:
//   - razorpay_order_id
//   - razorpay_payment_id
//   - razorpay_signature  (= HMAC_SHA256_HEX(KEY_SECRET, order_id|payment_id))
//
// If the signature verifies, the payment is provably authentic — we then
// dispatch to the SAME capture handlers the webhook calls, so the deposit
// row, payment_events row, booking status, and downstream side-effects all
// land identically.
//
// Inputs (POST JSON body):
//   {
//     booking_id:           uuid,
//     kind:                 'deposit' | 'balance',
//     side?:                'traveler' | 'buddy',   // required when kind=deposit
//     razorpay_order_id:    string,
//     razorpay_payment_id:  string,
//     razorpay_signature:   string,
//   }
//
// Auth: Bearer JWT. Caller must own the booking on the matching side
// (traveler for balance, traveler/buddy for deposit).
//
// Idempotency: the underlying capture handlers dedup by payment_id, so
// calling this function twice with the same IDs is a no-op on the second
// call. The webhook landing later is also idempotent for the same reason.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';
import { hmacSha256Hex, timingSafeEqual } from '../_shared/razorpaySignature.ts';
import {
  handleDepositCaptured,
  type DepositNotes,
} from '../_shared/depositCapture.ts';
import {
  handleBalanceCaptured,
  type BalanceNotes,
} from '../_shared/balanceCapture.ts';

interface RequestBody {
  booking_id:          string;
  kind:                'deposit' | 'balance';
  side?:               'traveler' | 'buddy';
  razorpay_order_id:   string;
  razorpay_payment_id: string;
  razorpay_signature:  string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  // ── Authn ─────────────────────────────────────────────────────────────────
  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  // ── Razorpay secret (server-side only) ───────────────────────────────────
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keySecret) return errorResponse('razorpay_not_configured', 500);

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return errorResponse('invalid_json', 400);
  }
  const { booking_id, kind, side, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse('missing_required_field', 400);
  }
  if (kind !== 'deposit' && kind !== 'balance') {
    return errorResponse('invalid_kind', 400);
  }
  if (kind === 'deposit' && side !== 'traveler' && side !== 'buddy') {
    return errorResponse('side_required_for_deposit', 400);
  }

  // ── Verify Razorpay checkout signature ───────────────────────────────────
  // Razorpay docs: signature = HMAC_SHA256_HEX(KEY_SECRET, order_id|payment_id)
  // Reference: https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#step-2-verify-the-payment-signature
  const message  = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = await hmacSha256Hex(keySecret, message);
  if (!timingSafeEqual(expected, razorpay_signature)) {
    return errorResponse('invalid_signature', 400);
  }

  // ── Authz: caller must own the booking on the matching side ──────────────
  const db = adminClient();
  const { data: booking, error: bookingErr } = await db
    .from('bookings')
    .select('id, traveler_id, guide_id')
    .eq('id', booking_id)
    .maybeSingle();

  if (bookingErr) return errorResponse(`db_error: ${bookingErr.message}`, 500);
  if (!booking)   return errorResponse('booking_not_found', 404);

  if (kind === 'deposit') {
    const expectedUserId = side === 'traveler' ? booking.traveler_id : booking.guide_id;
    if (expectedUserId !== caller.userId) return errorResponse('forbidden', 403);
  } else {
    // balance — only the traveler pays it
    if (booking.traveler_id !== caller.userId) return errorResponse('forbidden', 403);
  }

  // ── Look up the payment_events row we expect to settle ───────────────────
  // The order was created server-side by create-deposit-order or
  // create-balance-order — those functions write the order_id into either
  // `deposits` (deposit) or `payment_events` (balance). We pull deposit_id
  // for deposit so the underlying handler has the same notes shape the
  // webhook would.
  const capturedAtIso = new Date().toISOString();

  if (kind === 'deposit') {
    const { data: dep, error: depErr } = await db
      .from('deposits')
      .select('id')
      .eq('booking_id', booking_id)
      .eq('side', side)
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();

    if (depErr) return errorResponse(`db_error: ${depErr.message}`, 500);
    if (!dep)   return errorResponse('deposit_not_found_for_order', 404);

    const notes: DepositNotes = {
      booking_id,
      kind:       'deposit',
      side:       side as 'traveler' | 'buddy',
      deposit_id: dep.id,
    };

    const result = await handleDepositCaptured(db, {
      paymentId:     razorpay_payment_id,
      orderId:       razorpay_order_id,
      signature:     razorpay_signature,
      notes,
      capturedAtIso,
    });

    if (!result.ok) return errorResponse(result.error, 500);
    return jsonResponse({ ok: true, outcome: result });
  }

  // kind === 'balance'
  // Fetch trip start time for the T-12h jump.
  let tripStartsAtIso: string | undefined;
  const { data: agreement } = await db
    .from('agreements')
    .select('trip_starts_at')
    .eq('booking_id', booking_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (agreement?.trip_starts_at) {
    tripStartsAtIso = new Date(agreement.trip_starts_at).toISOString();
  }

  const notes: BalanceNotes = {
    booking_id,
    kind:                  'balance',
    is_late_fee_component: false,
  };

  const result = await handleBalanceCaptured(db, {
    paymentId: razorpay_payment_id,
    orderId:   razorpay_order_id,
    notes,
    capturedAtIso,
    tripStartsAtIso,
  });

  if (!result.ok) return errorResponse(result.error, 500);
  return jsonResponse({ ok: true, outcome: result });
});
