// ============================================================================
// CREATE-TOPUP-ORDER — Phase 4 Edge Function (traveler)
// ============================================================================
// Creates a Razorpay Order for an approved top-up request.
//
// Inputs: { booking_id, top_up_request_id }  Auth: traveler JWT
//
// Guards:
//   1. Caller must be the traveler on the booking.
//   2. top_up_requests.status must be 'approved' and not expired.
//   3. Idempotent: reuses an existing 'initiated' payment_events row.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';
import { createOrder } from '../_shared/razorpayClient.ts';
import type { Database } from '../_shared/database.types.ts';
import { existingTopUpOrder, linkTopUpOrder } from '../_shared/topupOrder.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  let body: { booking_id: string; top_up_request_id: string };
  try { body = await req.json(); }
  catch { return errorResponse('invalid_json', 400); }

  const { booking_id, top_up_request_id } = body;
  if (!booking_id)           return errorResponse('booking_id required', 400);
  if (!top_up_request_id)    return errorResponse('top_up_request_id required', 400);

  const db = adminClient();

  // ── 1. Load booking ────────────────────────────────────────────────────────
  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('id, traveler_id, status')
    .eq('id', booking_id)
    .single();

  if (bErr || !booking)                      return errorResponse('booking_not_found', 404);
  if (booking.traveler_id !== caller.userId) return errorResponse('forbidden', 403);
  if (booking.status !== 'in_progress')      return errorResponse(`not_in_progress:${booking.status}`, 409);

  // ── 2. Load top-up request ─────────────────────────────────────────────────
  const { data: topUp, error: tErr } = await db
    .from('top_up_requests')
    .select('id, requested_paise, status, expires_at, razorpay_order_id')
    .eq('id', top_up_request_id)
    .eq('booking_id', booking_id)
    .single();

  if (tErr || !topUp)              return errorResponse('top_up_request_not_found', 404);
  if (topUp.status !== 'approved') return errorResponse(`not_approved:${topUp.status}`, 409);
  if (new Date(topUp.expires_at) < new Date())
    return errorResponse('expired', 409);

  // ── 3. Idempotency survives a failed request-link write or checkout attempt.
  let existing: Awaited<ReturnType<typeof existingTopUpOrder>>;
  try {
    existing = await existingTopUpOrder(db, booking_id, top_up_request_id, topUp.razorpay_order_id);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'payment_event_lookup_failed';
    return errorResponse(code, code === 'topup_already_paid' ? 409 : 503);
  }
  const existingEvent = existing.payment;

  if (existingEvent?.razorpay_order_id) {
    try { await linkTopUpOrder(db, booking_id, top_up_request_id, existingEvent.razorpay_order_id); }
    catch { return errorResponse('topup_order_link_failed', 503); }
    return jsonResponse({
      order_id:         existingEvent.razorpay_order_id,
      amount_paise:     topUp.requested_paise,
      currency:         'INR',
      payment_event_id: existingEvent.id,
    });
  }

  // ── 4. Create Razorpay order ───────────────────────────────────────────────
  const order = await createOrder({
    amount_paise: topUp.requested_paise,
    currency:     'INR',
    receipt:      `topup_${top_up_request_id.slice(0, 8)}`,
    notes: {
      kind:               'top_up',
      booking_id,
      top_up_request_id,
    },
  });

  // ── 5. Insert payment_events row ──────────────────────────────────────────
  const paymentEvent = {
      booking_id,
      kind:               'top_up',
      status:             'initiated',
      amount_paise:       topUp.requested_paise,
      razorpay_order_id:  order.order_id,
      user_id:            caller.userId,
      idempotency_key:    existing.key,
    } satisfies Database['public']['Tables']['payment_events']['Insert'];
  const { data: payEvent, error: peErr } = await db
    .from('payment_events')
    .insert(paymentEvent)
    .select('id')
    .single();

  if (peErr) return errorResponse(`payment_event_insert_failed: ${peErr.message}`, 500);

  // ── 6. Stamp razorpay_order_id on the top-up request ──────────────────────
  try { await linkTopUpOrder(db, booking_id, top_up_request_id, order.order_id); }
  catch { return errorResponse('topup_order_link_failed', 503); }

  return jsonResponse({
    order_id:         order.order_id,
    amount_paise:     topUp.requested_paise,
    currency:         'INR',
    payment_event_id: payEvent.id,
  });
});
