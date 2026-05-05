// ============================================================================
// ISSUE-REFUND — Phase 3 Edge Function (admin/service-role only)
// ============================================================================
// Inputs (POST JSON body — choose ONE):
//   { payout_dispatch_id: uuid }   — dispatch a single row
//   { booking_id: uuid }           — dispatch all pending rows for a booking
//
// Auth: service_role Authorization header only.
//
// Behaviour:
//   - Looks up payout_dispatches row(s).
//   - Dispatches via razorpayClient.createRefund or createPayout.
//   - Updates row status to 'sent' (or 'failed').
//   - Returns { dispatched: N, succeeded: N, failed: [...] }.
//
// Used by:
//   1. Force-majeure adjudications (ops triggers this endpoint after verifying
//      the event).
//   2. The replay-stubbed-payouts runbook (live-key flip step 4).
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabaseAdmin.ts';
import {
  createRefund,
  createPayout,
  createFundAccount,
  idempotencyKey,
  RazorpayLiveNotConfiguredError,
} from '../_shared/razorpayClient.ts';

interface RequestBody {
  payout_dispatch_id?: string;
  booking_id?:         string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  // ── Service-role only ────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey || !authHeader.includes(serviceKey)) {
    return errorResponse('forbidden: service_role required', 403);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 400);
  }

  const { payout_dispatch_id, booking_id } = body;
  if (!payout_dispatch_id && !booking_id) {
    return errorResponse('payout_dispatch_id or booking_id required', 400);
  }

  const db = adminClient();

  // ── Load rows ────────────────────────────────────────────────────────────
  let query = db
    .from('payout_dispatches')
    .select('*')
    .in('status', ['pending', 'failed']);

  if (payout_dispatch_id) {
    query = query.eq('id', payout_dispatch_id);
  } else if (booking_id) {
    query = query.eq('booking_id', booking_id);
  }

  const { data: dispatches, error: dErr } = await query;
  if (dErr) return errorResponse('db_error', 500);
  if (!dispatches?.length) return jsonResponse({ dispatched: 0, succeeded: 0, failed: [] });

  // Explicit routing sets — endsWith('_refund') is too broad (buddy_fee_cancellation_refund
  // is a Razorpay Refund back to the traveler, NOT a Payout to the buddy).
  const REFUND_KINDS = new Set([
    'traveler_refund',
    'traveler_deposit_refund',
    'buddy_deposit_refund',
    'trip_fund_cancellation_refund',
    'buddy_fee_cancellation_refund',
  ]);
  const PAYOUT_KINDS = new Set(['buddy_fee_final', 'trip_pot_release']);

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const dispatch of dispatches) {
    try {
      const iKey = await idempotencyKey([dispatch.id, dispatch.kind, dispatch.booking_id]);

      if (REFUND_KINDS.has(dispatch.kind)) {
        // Find the payment to refund against.
        const { data: payEvent } = await db
          .from('payment_events')
          .select('razorpay_payment_id')
          .eq('booking_id', dispatch.booking_id)
          .in('kind', ['deposit', 'balance'])
          .eq('status', 'captured')
          .order('initiated_at', { ascending: true })
          .limit(1)
          .single();

        if (!payEvent?.razorpay_payment_id) {
          throw new Error('no_captured_payment_found');
        }

        const result = await createRefund({
          payment_id:      payEvent.razorpay_payment_id,
          amount_paise:    dispatch.net_paise,
          idempotency_key: iKey,
          notes: { booking_id: dispatch.booking_id, kind: dispatch.kind },
        });

        await db
          .from('payout_dispatches')
          .update({
            status:             'sent',
            razorpay_refund_id: result.refund_id,
            failed_reason:      null,
            completed_at:       new Date().toISOString(),
          })
          .eq('id', dispatch.id);
      } else if (PAYOUT_KINDS.has(dispatch.kind)) {
        // Payout to fund account.
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
          await db
            .from('users')
            .update({ razorpay_fund_account_id: fundAccountId })
            .eq('id', dispatch.recipient_user_id);
        }

        const result = await createPayout({
          fund_account_id: fundAccountId,
          amount_paise:    dispatch.net_paise,
          idempotency_key: iKey,
          notes: { booking_id: dispatch.booking_id, kind: dispatch.kind },
        });

        await db
          .from('payout_dispatches')
          .update({
            status:                   'sent',
            razorpay_payout_id:       result.payout_id,
            razorpay_fund_account_id: fundAccountId,
            failed_reason:            null,
            completed_at:             new Date().toISOString(),
          })
          .eq('id', dispatch.id);
      } else {
        throw new Error(`unroutable_kind: ${dispatch.kind}`);
      }

      results.push({ id: dispatch.id, ok: true });
    } catch (err) {
      const msg = err instanceof RazorpayLiveNotConfiguredError
        ? 'razorpay_live_not_configured'
        : String(err);

      await db
        .from('payout_dispatches')
        .update({ status: 'failed', failed_reason: msg })
        .eq('id', dispatch.id);

      results.push({ id: dispatch.id, ok: false, error: msg });
    }
  }

  const succeeded = results.filter(r => r.ok).length;
  const failed    = results.filter(r => !r.ok);

  return jsonResponse({
    dispatched: results.length,
    succeeded,
    failed,
  });
});
