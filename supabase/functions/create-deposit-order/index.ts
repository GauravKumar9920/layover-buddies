// ============================================================================
// CREATE-DEPOSIT-ORDER (Phase 2 Edge Function)
// ============================================================================
// Creates a Razorpay order for a ₹500 refundable deposit and persists the
// matching `deposits` + `payment_events` rows in pending/initiated state.
// The actual capture is confirmed by the `razorpay-webhook` function — this
// endpoint just sets up the order and returns the IDs the mobile checkout
// sheet needs.
//
// Inputs (POST JSON body):
//   { booking_id: uuid, side: 'traveler' | 'buddy' }
// Auth:
//   Bearer JWT in Authorization header. Caller must be the matching party.
// Returns:
//   { order_id, amount_paise, currency, key_id, deposit_id }
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';

const RAZORPAY_API = 'https://api.razorpay.com/v1/orders';
const DEPOSIT_PAISE = 50_000;     // ₹500 — see apps/mobile/config/constants.ts

interface RequestBody {
  booking_id: string;
  side: 'traveler' | 'buddy';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  // ── Authn: who is calling? ────────────────────────────────────────────────
  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  // ── Razorpay creds (configured via `supabase secrets set`) ────────────────
  const keyId     = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) {
    return errorResponse('razorpay_not_configured', 500);
  }

  // ── Parse + validate body ────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return errorResponse('invalid_json', 400);
  }
  if (!body.booking_id || (body.side !== 'traveler' && body.side !== 'buddy')) {
    return errorResponse('booking_id and side ("traveler"|"buddy") are required', 400);
  }

  const supabase = adminClient();

  // ── Authz: caller must own the booking on the requested side ─────────────
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, traveler_id, guide_id, status')
    .eq('id', body.booking_id)
    .maybeSingle();

  if (bookingErr) return errorResponse(`db_error: ${bookingErr.message}`, 500);
  if (!booking)   return errorResponse('booking_not_found', 404);

  const expectedUserId = body.side === 'traveler' ? booking.traveler_id : booking.guide_id;
  if (expectedUserId !== caller.userId) {
    return errorResponse('forbidden', 403);
  }

  // `awaiting_deposits` = neither side paid yet. `deposits_held` = exactly
  // one side has paid (the booking only flips to `awaiting_balance` once
  // BOTH deposits land), and the unpaid side must still be able to create
  // their order. The existing-deposit check below catches the "already
  // held" case for the side that has paid, so allowing `deposits_held` here
  // is safe and necessary for the second-deposit path.
  if (booking.status !== 'awaiting_deposits' && booking.status !== 'deposits_held') {
    return errorResponse('booking_not_awaiting_deposits', 409, {
      current_status: booking.status,
    });
  }

  // ── Idempotent UPSERT into `deposits` ────────────────────────────────────
  // unique (booking_id, side) per Phase 1 schema; first call inserts, subsequent
  // calls reuse if pending and recent.
  const { data: existing, error: existingErr } = await supabase
    .from('deposits')
    .select('id, status, razorpay_order_id, created_at')
    .eq('booking_id', body.booking_id)
    .eq('side', body.side)
    .maybeSingle();

  if (existingErr) return errorResponse(`db_error: ${existingErr.message}`, 500);

  if (existing?.status === 'held') {
    return errorResponse('deposit_already_held', 409);
  }

  // Re-use any pending order that already has a Razorpay order_id. Razorpay
  // orders don't expire short-term, so a pending row always has a valid order
  // to retry the checkout against. Using `created_at` for a recency window was
  // broken because that timestamp never changes after insert.
  if (existing?.razorpay_order_id && existing.status === 'pending') {
    return jsonResponse({
      order_id:     existing.razorpay_order_id,
      amount_paise: DEPOSIT_PAISE,
      currency:     'INR',
      key_id:       keyId,
      deposit_id:   existing.id,
      reused:       true,
    });
  }

  // Insert (or refresh) the deposit row.
  const depositRow = {
    booking_id:   body.booking_id,
    user_id:      caller.userId,
    side:         body.side,
    amount_paise: DEPOSIT_PAISE,
    status:       'pending' as const,
  };

  let depositId = existing?.id ?? null;
  if (!depositId) {
    const { data: inserted, error: insertErr } = await supabase
      .from('deposits')
      .insert(depositRow)
      .select('id')
      .single();
    if (insertErr) return errorResponse(`db_error: ${insertErr.message}`, 500);
    depositId = inserted.id;
  }

  // ── Create the Razorpay order ────────────────────────────────────────────
  const razorpayRes = await fetch(RAZORPAY_API, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      amount:   DEPOSIT_PAISE,
      currency: 'INR',
      // 40-char limit — booking-id slice + side disambiguator
      receipt:  `dep_${body.side[0]}_${body.booking_id.slice(0, 30)}`,
      notes: {
        booking_id: body.booking_id,
        kind:       'deposit',
        side:       body.side,
        deposit_id: depositId,
      },
    }),
  });

  if (!razorpayRes.ok) {
    const errText = await razorpayRes.text();
    return errorResponse(`razorpay_error: ${errText}`, razorpayRes.status);
  }

  const order = (await razorpayRes.json()) as { id: string; amount: number; currency: string };

  // ── Persist order_id on deposit + insert payment_events row ─────────────
  const { error: updateErr } = await supabase
    .from('deposits')
    .update({ razorpay_order_id: order.id })
    .eq('id', depositId);

  if (updateErr) return errorResponse(`db_error: ${updateErr.message}`, 500);

  const { error: peErr } = await supabase
    .from('payment_events')
    .insert({
      booking_id:        body.booking_id,
      user_id:           caller.userId,
      kind:              'deposit',
      amount_paise:      DEPOSIT_PAISE,
      status:            'initiated',
      razorpay_order_id: order.id,
    });

  if (peErr) return errorResponse(`db_error: ${peErr.message}`, 500);

  return jsonResponse({
    order_id:     order.id,
    amount_paise: order.amount,
    currency:     order.currency,
    key_id:       keyId,
    deposit_id:   depositId,
    reused:       false,
  });
});
