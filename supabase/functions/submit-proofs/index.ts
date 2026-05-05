// ============================================================================
// SUBMIT-PROOFS — Phase 4 Edge Function (buddy)
// ============================================================================
// Transitions awaiting_proofs → reconciling → completed.
//
// Inputs: { booking_id: uuid }  Auth: buddy JWT
//
// Behaviour:
//   1. Guard: caller = buddy, status = awaiting_proofs, ≥1 proof uploaded.
//   2. Transition: awaiting_proofs → reconciling.
//   3. Call compute_reconciliation_tx RPC (atomic).
//   4. Dispatch payout_dispatches rows via razorpayClient (stub-safe).
//   5. Transition: reconciling → completed (on successful dispatch or stub).
//   6. Return snapshot.
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  let body: { booking_id: string };
  try { body = await req.json(); }
  catch { return errorResponse('invalid_json', 400); }

  if (!body.booking_id) return errorResponse('booking_id required', 400);

  const db = adminClient();

  // ── 1. Load + validate booking ────────────────────────────────────────────
  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('id, guide_id, traveler_id, status')
    .eq('id', body.booking_id)
    .single();

  if (bErr || !booking)                   return errorResponse('booking_not_found', 404);
  if (booking.guide_id !== caller.userId) return errorResponse('forbidden', 403);
  if (booking.status !== 'awaiting_proofs') return errorResponse(`not_awaiting_proofs:${booking.status}`, 409);

  // ── 2. Guard: at least one proof uploaded ─────────────────────────────────
  const { count: proofCount } = await db
    .from('expense_proofs')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', body.booking_id);

  if (!proofCount || proofCount < 1) {
    return errorResponse('no_proofs_uploaded', 422);
  }

  // ── 3. Transition to reconciling ──────────────────────────────────────────
  const { error: r1Err } = await db
    .from('bookings')
    .update({ status: 'reconciling' })
    .eq('id', body.booking_id)
    .eq('status', 'awaiting_proofs');

  if (r1Err) return errorResponse(`reconciling_transition_failed: ${r1Err.message}`, 500);

  // ── 4. Run the Postgres reconciliation function ───────────────────────────
  const { data: snapshot, error: rpcErr } = await db
    .rpc('compute_reconciliation_tx', { p_booking_id: body.booking_id });

  if (rpcErr) {
    console.error('compute_reconciliation_tx error:', rpcErr);
    return errorResponse('reconciliation_failed', 500);
  }

  // ── 5. Dispatch payout_dispatches rows ────────────────────────────────────
  const { data: dispatches } = await db
    .from('payout_dispatches')
    .select('*')
    .eq('booking_id', body.booking_id)
    .eq('status', 'pending')
    .in('kind', ['buddy_fee_final', 'traveler_refund']);

  for (const dispatch of dispatches ?? []) {
    try {
      const iKey = await idempotencyKey([dispatch.id, dispatch.kind, body.booking_id]);

      if (dispatch.kind === 'traveler_refund') {
        // Refund against the captured balance payment.
        const { data: payEvent } = await db
          .from('payment_events')
          .select('razorpay_payment_id')
          .eq('booking_id', body.booking_id)
          .eq('kind', 'balance')
          .eq('status', 'captured')
          .maybeSingle();

        if (payEvent?.razorpay_payment_id) {
          const result = await createRefund({
            payment_id:      payEvent.razorpay_payment_id,
            amount_paise:    dispatch.net_paise,
            idempotency_key: iKey,
            notes: { booking_id: body.booking_id, kind: 'traveler_refund' },
          });
          await db.from('payout_dispatches').update({
            status: 'sent', razorpay_refund_id: result.refund_id,
            completed_at: new Date().toISOString(),
          }).eq('id', dispatch.id);
        }
      } else if (dispatch.kind === 'buddy_fee_final') {
        const { data: buddy } = await db
          .from('users')
          .select('payout_vpa, razorpay_fund_account_id')
          .eq('id', dispatch.recipient_user_id)
          .single();

        if (buddy?.payout_vpa) {
          let fundAccountId = buddy.razorpay_fund_account_id;
          if (!fundAccountId) {
            const fa = await createFundAccount({
              contact_id:          dispatch.recipient_user_id,
              vpa:                 buddy.payout_vpa,
              account_holder_name: '',
            });
            fundAccountId = fa.fund_account_id;
            await db.from('users').update({ razorpay_fund_account_id: fundAccountId }).eq('id', dispatch.recipient_user_id);
          }
          const result = await createPayout({
            fund_account_id: fundAccountId,
            amount_paise:    dispatch.net_paise,
            idempotency_key: iKey,
            notes: { booking_id: body.booking_id, kind: 'buddy_fee_final' },
          });
          await db.from('payout_dispatches').update({
            status: 'sent', razorpay_payout_id: result.payout_id,
            razorpay_fund_account_id: fundAccountId,
            completed_at: new Date().toISOString(),
          }).eq('id', dispatch.id);
        }
      }
    } catch (err) {
      const reason = err instanceof RazorpayLiveNotConfiguredError
        ? 'razorpay_live_not_configured' : String(err);
      await db.from('payout_dispatches')
        .update({ failed_reason: reason })
        .eq('id', dispatch.id);
    }
  }

  // ── 6. Transition to completed ────────────────────────────────────────────
  await db.from('bookings')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', body.booking_id)
    .eq('status', 'reconciling');

  return jsonResponse({ ok: true, booking_status: 'completed', snapshot });
});
