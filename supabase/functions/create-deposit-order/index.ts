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
import { createOrder, idempotencyKey } from '../_shared/razorpayClient.ts';

const DEPOSIT_PAISE = 50_000;     // ₹500 — see apps/mobile/config/constants.ts

interface RequestBody {
  booking_id: string;
  side: 'traveler' | 'buddy';
}

// The deposit link can be saved before its ledger insert succeeds. Recover
// that insert before offering checkout, even for previously created orders.
async function ensureDepositLedger(
  db: ReturnType<typeof adminClient>,
  deposit: { booking_id: string; user_id: string; amount_paise: number; razorpay_order_id: string },
): Promise<boolean> {
  const lookup = () => db.from('payment_events').select('id, amount_paise, status')
    .eq('booking_id', deposit.booking_id).eq('user_id', deposit.user_id)
    .eq('razorpay_order_id', deposit.razorpay_order_id).eq('kind', 'deposit').maybeSingle();
  const reusable = (event: { amount_paise: number; status: string } | null) =>
    event?.amount_paise === deposit.amount_paise && ['initiated', 'failed'].includes(event.status);

  const { data: existing, error } = await lookup();
  if (error) return false;
  if (existing) return reusable(existing);

  const { error: insertError } = await db.from('payment_events').insert({
    ...deposit,
    kind: 'deposit',
    status: 'initiated',
    idempotency_key: await idempotencyKey(['deposit_order', deposit.razorpay_order_id]),
  });
  if (!insertError) return true;
  if (insertError.code !== '23505') return false;
  const { data: raced, error: readError } = await lookup();
  return !readError && reusable(raced);
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
  if (typeof body?.booking_id !== 'string' || !body.booking_id || (body.side !== 'traveler' && body.side !== 'buddy')) {
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

  // deposits_held is a transitional state before awaiting_balance. Check the
  // caller's own deposit state before offering checkout during that transition.
  if (booking.status !== 'awaiting_deposits' && booking.status !== 'deposits_held') {
    return errorResponse('booking_not_awaiting_deposits', 409, {
      current_status: booking.status,
    });
  }

  // Each booking side has one deposit row. Reuse an existing pending one.
  const { data: existing, error: existingErr } = await supabase
    .from('deposits')
    .select('id, status, razorpay_order_id, amount_paise')
    .eq('booking_id', body.booking_id)
    .eq('side', body.side)
    .maybeSingle();

  if (existingErr) return errorResponse(`db_error: ${existingErr.message}`, 500);

  if (existing && existing.status !== 'pending') {
    return errorResponse(existing.status === 'held' ? 'deposit_already_held' : 'deposit_not_pending', 409);
  }

  const depositAmount = existing?.amount_paise ?? DEPOSIT_PAISE;
  const payment = {
    booking_id: body.booking_id,
    user_id: caller.userId,
    amount_paise: depositAmount,
  };
  if (existing?.razorpay_order_id) {
    if (!await ensureDepositLedger(supabase, { ...payment, razorpay_order_id: existing.razorpay_order_id })) {
      return errorResponse('deposit_payment_event_unavailable', 503);
    }
    return jsonResponse({
      order_id:     existing.razorpay_order_id,
      amount_paise: depositAmount,
      currency:     'INR',
      key_id:       keyId,
      deposit_id:   existing.id,
      reused:       true,
    });
  }

  // Insert the deposit row before creating the provider order.
  const depositRow = {
    ...payment,
    side:         body.side,
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
  let order: Awaited<ReturnType<typeof createOrder>>;
  try {
    order = await createOrder({
      amount_paise: depositAmount,
      // 40-char limit — booking-id slice + side disambiguator
      receipt:  `dep_${body.side[0]}_${body.booking_id.slice(0, 30)}`,
      notes: {
        booking_id: body.booking_id,
        kind:       'deposit',
        side:       body.side,
        deposit_id: depositId,
      },
    });
  } catch {
    return errorResponse('razorpay_order_failed', 502);
  }

  const { data: linked, error: updateErr } = await supabase
    .from('deposits')
    .update({ razorpay_order_id: order.order_id })
    .eq('id', depositId)
    .eq('status', 'pending')
    .is('razorpay_order_id', null)
    .select('id')
    .maybeSingle();

  if (updateErr || !linked) return errorResponse('deposit_order_link_failed', 503);
  if (!await ensureDepositLedger(supabase, { ...payment, razorpay_order_id: order.order_id })) {
    return errorResponse('deposit_payment_event_unavailable', 503);
  }

  return jsonResponse({
    order_id:     order.order_id,
    amount_paise: order.amount,
    currency:     order.currency,
    key_id:       keyId,
    deposit_id:   depositId,
    reused:       false,
  });
});
