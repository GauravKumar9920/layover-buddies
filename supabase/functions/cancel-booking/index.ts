// ============================================================================
// CANCEL-BOOKING — Phase 3 Edge Function
// ============================================================================
// Inputs (POST JSON body):
//   { booking_id: uuid, reason?: string }
//   Authorization: Bearer <user_jwt>
//
// Behaviour:
//   1. Verify caller is a party to the booking (traveler or buddy).
//   2. Validate the booking is in a cancellable state.
//   3. Call compute_cancellation_resolution_tx() RPC — writes resolution JSONB,
//      transitions booking status, creates payout_dispatches rows.
//   4. Dispatch each pending payout_dispatch via razorpayClient
//      (createRefund/createPayout). Stubs gracefully when live keys absent.
//   5. Return { ok, booking_status, resolution }.
//
// Force-majeure adjudication is handled separately via a service-role admin
// endpoint — this fn only handles voluntary cancellations.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';
import {
  createRefund,
  createPayout,
  createFundAccount,
  idempotencyKey,
  RazorpayLiveNotConfiguredError,
} from '../_shared/razorpayClient.ts';

interface RequestBody {
  booking_id: string;
  reason?:    string;
}

/** Booking statuses from which a voluntary cancellation is permitted. */
const CANCELLABLE_STATUSES = new Set([
  'chat_open',
  'agreement_drafting',
  'agreement_sent',
  'agreement_signed_traveler',
  'agreement_signed_buddy',
  'awaiting_deposits',
  'deposits_held',
  'awaiting_balance',
  'late_fee_due',
  'balance_paid',
  'trip_ready',
]);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  // ── Authn ────────────────────────────────────────────────────────────────
  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  // ── Body ─────────────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 400);
  }
  const { booking_id, reason } = body;
  if (!booking_id) return errorResponse('booking_id required', 400);

  const db = adminClient();

  // ── Load booking ─────────────────────────────────────────────────────────
  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('id, traveler_id, guide_id, status')
    .eq('id', booking_id)
    .single();

  if (bErr || !booking) return errorResponse('booking_not_found', 404);

  // ── Authz: caller must be a party ────────────────────────────────────────
  const isTraveler = booking.traveler_id === caller.id;
  const isBuddy    = booking.guide_id    === caller.id;
  if (!isTraveler && !isBuddy) return errorResponse('forbidden', 403);

  // ── Guard: booking must be in a cancellable state ────────────────────────
  if (!CANCELLABLE_STATUSES.has(booking.status)) {
    return errorResponse(`booking_status_not_cancellable:${booking.status}`, 409);
  }

  const actor = isTraveler ? 'traveler' : 'buddy';

  // ── Run the resolver (atomic in Postgres) ────────────────────────────────
  const { data: resolution, error: rErr } = await db
    .rpc('compute_cancellation_resolution_tx', {
      p_booking_id: booking_id,
      p_trigger:    'voluntary',
      p_actor:      actor,
    });

  if (rErr) {
    console.error('compute_cancellation_resolution_tx error:', rErr);
    return errorResponse('resolution_failed', 500);
  }

  // ── Persist reason (best-effort; not in the atomic tx) ───────────────────
  if (reason) {
    await db
      .from('bookings')
      .update({ cancelled_reason: reason })
      .eq('id', booking_id);
  }

  // ── Dispatch payout_dispatches rows (stub-friendly) ──────────────────────
  const { data: dispatches } = await db
    .from('payout_dispatches')
    .select('*')
    .eq('booking_id', booking_id)
    .eq('status', 'pending');

  for (const dispatch of dispatches ?? []) {
    try {
      const iKey = await idempotencyKey([dispatch.id, dispatch.kind, booking_id]);

      if (dispatch.kind.endsWith('_refund')) {
        // Cancellation refunds go back via Razorpay Refund API.
        // We need the original razorpay_payment_id from payment_events.
        const { data: payEvent } = await db
          .from('payment_events')
          .select('razorpay_payment_id')
          .eq('booking_id', booking_id)
          .in('kind', ['deposit', 'balance'])
          .eq('status', 'captured')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (payEvent?.razorpay_payment_id) {
          const result = await createRefund({
            payment_id:      payEvent.razorpay_payment_id,
            amount_paise:    dispatch.net_paise,
            idempotency_key: iKey,
            notes: { booking_id, kind: dispatch.kind },
          });
          await db
            .from('payout_dispatches')
            .update({
              status:              'sent',
              razorpay_refund_id:  result.refund_id,
              completed_at:        new Date().toISOString(),
            })
            .eq('id', dispatch.id);
        }
      } else {
        // Buddy payouts go via Razorpay Payouts API.
        const { data: recipient } = await db
          .from('users')
          .select('payout_vpa, razorpay_fund_account_id')
          .eq('id', dispatch.recipient_user_id)
          .single();

        if (recipient?.payout_vpa) {
          let fundAccountId = recipient.razorpay_fund_account_id;
          if (!fundAccountId) {
            const fa = await createFundAccount({
              contact_id:          dispatch.recipient_user_id,
              vpa:                 recipient.payout_vpa,
              account_holder_name: '',
            });
            fundAccountId = fa.fund_account_id;
            await db.from('users').update({ razorpay_fund_account_id: fundAccountId }).eq('id', dispatch.recipient_user_id);
          }
          const result = await createPayout({
            fund_account_id: fundAccountId,
            amount_paise:    dispatch.net_paise,
            idempotency_key: iKey,
            notes: { booking_id, kind: dispatch.kind },
          });
          await db
            .from('payout_dispatches')
            .update({
              status:                   'sent',
              razorpay_payout_id:       result.payout_id,
              razorpay_fund_account_id: fundAccountId,
              completed_at:             new Date().toISOString(),
            })
            .eq('id', dispatch.id);
        }
      }
    } catch (err) {
      if (err instanceof RazorpayLiveNotConfiguredError) {
        // Expected in stub mode — row stays pending with the failed_reason.
        await db
          .from('payout_dispatches')
          .update({ failed_reason: 'razorpay_live_not_configured' })
          .eq('id', dispatch.id);
      } else {
        // Real dispatch error — mark failed for retry.
        await db
          .from('payout_dispatches')
          .update({ status: 'failed', failed_reason: String(err) })
          .eq('id', dispatch.id);
      }
    }
  }

  return jsonResponse({
    ok:             true,
    booking_status: resolution?.next_booking_status,
    resolution,
  });
});
