// ============================================================================
// REPLAY-STUBBED-PAYOUTS — Phase 4 admin Edge Function
// ============================================================================
// One-shot endpoint to replay all payout_dispatches rows that were stubbed
// while RAZORPAY_LIVE_FEATURES_ENABLED was unset.
//
// Auth: service-role bearer token only.
// Inputs (optional): { limit?: number }  — defaults to 50 per run
//
// Behaviour:
//   1. SELECT payout_dispatches WHERE failed_reason = 'razorpay_live_not_configured'
//      ORDER BY created_at LIMIT {limit}.
//   2. For each row: call createRefund (traveler_refund, cancellation refunds)
//      OR createPayout (buddy payouts, trip_pot_release) via razorpayClient.
//   3. On success: UPDATE status='sent', razorpay_*_id, completed_at.
//   4. On failure: UPDATE failed_reason with the new error (leaves as 'failed').
//   5. Return { replayed, succeeded, failed: [{id, kind, error}] }.
//
// Run this ONCE after setting RAZORPAY_LIVE_FEATURES_ENABLED=true and the
// live Razorpay keys. Safe to re-run — already-sent rows are skipped by the
// SELECT filter.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabaseAdmin.ts';
import {
  createRefund,
  createPayout,
  createFundAccount,
  idempotencyKey,
} from '../_shared/razorpayClient.ts';

// Service-role-only guard: caller must present the service role key as bearer.
function isServiceRole(req: Request): boolean {
  const auth   = req.headers.get('authorization') ?? '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  return bearer === (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
}

// buddy_fee_cancellation_refund = Razorpay Refund back to the traveler (NOT a payout).
const REFUND_KINDS  = new Set(['traveler_refund', 'traveler_deposit_refund', 'buddy_deposit_refund', 'trip_fund_cancellation_refund', 'buddy_fee_cancellation_refund']);
const PAYOUT_KINDS  = new Set(['buddy_fee_final', 'trip_pot_release']);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);
  if (!isServiceRole(req))      return errorResponse('unauthorized', 401);

  let body: { limit?: number } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }
  const limit = Math.min(body.limit ?? 50, 200);

  const db = adminClient();

  // ── 1. Fetch stuck rows ────────────────────────────────────────────────────
  const { data: dispatches, error: qErr } = await db
    .from('payout_dispatches')
    .select('*')
    .eq('failed_reason', 'razorpay_live_not_configured')
    .order('initiated_at', { ascending: true })
    .limit(limit);

  if (qErr) return errorResponse(`fetch_failed: ${qErr.message}`, 500);
  if (!dispatches?.length) return jsonResponse({ replayed: 0, succeeded: 0, failed: [] });

  const results: { id: string; kind: string; error?: string }[] = [];
  let succeeded = 0;

  // ── 2. Replay each row ─────────────────────────────────────────────────────
  for (const dispatch of dispatches) {
    const iKey = await idempotencyKey([dispatch.id, dispatch.kind, dispatch.booking_id]);
    try {
      if (REFUND_KINDS.has(dispatch.kind) && !PAYOUT_KINDS.has(dispatch.kind)) {
        // Find the captured balance payment to refund against.
        const { data: payEvent } = await db
          .from('payment_events')
          .select('razorpay_payment_id')
          .eq('booking_id', dispatch.booking_id)
          .in('kind', ['balance', 'deposit'])
          .eq('status', 'captured')
          .order('initiated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!payEvent?.razorpay_payment_id) {
          throw new Error('no_captured_payment_to_refund');
        }

        const result = await createRefund({
          payment_id:      payEvent.razorpay_payment_id,
          amount_paise:    dispatch.net_paise,
          idempotency_key: iKey,
          notes: { booking_id: dispatch.booking_id, kind: dispatch.kind, dispatch_id: dispatch.id },
        });

        await db.from('payout_dispatches').update({
          status:            'sent',
          razorpay_refund_id: result.refund_id,
          failed_reason:     null,
          completed_at:      new Date().toISOString(),
        }).eq('id', dispatch.id);

      } else if (PAYOUT_KINDS.has(dispatch.kind)) {
        // Payout to buddy's VPA.
        const { data: recipient } = await db
          .from('users')
          .select('payout_vpa, razorpay_fund_account_id')
          .eq('id', dispatch.recipient_user_id)
          .single();

        if (!recipient?.payout_vpa) throw new Error('vpa_missing');

        let fundAccountId = recipient.razorpay_fund_account_id;
        if (!fundAccountId) {
          const fa = await createFundAccount({
            contact_id:          dispatch.recipient_user_id,
            vpa:                 recipient.payout_vpa,
            account_holder_name: '',
          });
          fundAccountId = fa.fund_account_id;
          await db.from('users')
            .update({ razorpay_fund_account_id: fundAccountId })
            .eq('id', dispatch.recipient_user_id);
        }

        const result = await createPayout({
          fund_account_id: fundAccountId,
          amount_paise:    dispatch.net_paise,
          idempotency_key: iKey,
          notes: { booking_id: dispatch.booking_id, kind: dispatch.kind, dispatch_id: dispatch.id },
        });

        await db.from('payout_dispatches').update({
          status:                    'sent',
          razorpay_payout_id:        result.payout_id,
          razorpay_fund_account_id:  fundAccountId,
          failed_reason:             null,
          completed_at:              new Date().toISOString(),
        }).eq('id', dispatch.id);
      }

      succeeded++;
      results.push({ id: dispatch.id, kind: dispatch.kind });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await db.from('payout_dispatches')
        .update({ failed_reason: `replay_failed: ${errMsg}` })
        .eq('id', dispatch.id);
      results.push({ id: dispatch.id, kind: dispatch.kind, error: errMsg });
    }
  }

  return jsonResponse({
    replayed:  dispatches.length,
    succeeded,
    failed:    results.filter(r => r.error),
  });
});
