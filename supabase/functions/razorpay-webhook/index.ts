// ============================================================================
// RAZORPAY-WEBHOOK (Phase 2+3 Edge Function — the brain)
// ============================================================================
// Verifies the X-Razorpay-Signature HMAC, then dispatches payment events
// into the appropriate business-logic handler based on notes.kind:
//   'deposit' → handleDepositCaptured   (Phase 2)
//   'balance' → handleBalanceCaptured   (Phase 3)
//   'top_up'  → handleTopUpCaptured     (Phase 3/E, wired in Stage E)
//
// Configure in Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://<project>.supabase.co/functions/v1/razorpay-webhook
//   Events: payment.captured, payment.failed
//   Secret: set the same value as RAZORPAY_WEBHOOK_SECRET (via `supabase
//           secrets set RAZORPAY_WEBHOOK_SECRET=<value>`)
//
// Idempotency is guaranteed by the dedup check inside each capture handler.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabaseAdmin.ts';
import { verifyRazorpaySignature } from '../_shared/razorpaySignature.ts';
import {
  handleDepositCaptured,
  handleDepositFailed,
  type DepositNotes,
} from '../_shared/depositCapture.ts';
import {
  handleBalanceCaptured,
  type BalanceNotes,
} from '../_shared/balanceCapture.ts';
import {
  handleTopUpCaptured,
  type TopUpCapturePayload,
} from '../_shared/topupCapture.ts';

interface RazorpayPaymentNotes {
  kind?:                  string;
  booking_id?:            string;
  // deposit-specific
  side?:                  string;
  deposit_id?:            string;
  // balance-specific
  is_late_fee_component?: string;
  // top_up-specific
  top_up_request_id?:     string;
}

interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  amount?: number | string; // paise; Razorpay may send as number or numeric string
  notes?: RazorpayPaymentNotes;
  error_description?: string;
  error_reason?: string;
}

interface RazorpayWebhookEvent {
  event: string;
  payload: { payment: { entity: RazorpayPayment } };
  created_at?: number;
}

function extractDepositNotes(p: RazorpayPayment): DepositNotes | null {
  const n = p.notes;
  if (!n || n.kind !== 'deposit') return null;
  if (!n.booking_id || !n.deposit_id || !n.side) return null;
  if (n.side !== 'traveler' && n.side !== 'buddy') return null;
  return {
    booking_id: n.booking_id,
    kind:       'deposit',
    side:       n.side as 'traveler' | 'buddy',
    deposit_id: n.deposit_id,
  };
}

function extractBalanceNotes(p: RazorpayPayment): BalanceNotes | null {
  const n = p.notes;
  if (!n || n.kind !== 'balance') return null;
  if (!n.booking_id) return null;
  return {
    booking_id:            n.booking_id,
    kind:                  'balance',
    is_late_fee_component: n.is_late_fee_component === 'true',
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  // ── Read raw body (must be raw bytes for HMAC verification) ──────────────
  const rawBody = await req.text();

  // ── Verify signature ─────────────────────────────────────────────────────
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  if (!secret) {
    // Misconfiguration on our side — fail loudly server-side, return 500.
    return errorResponse('webhook_secret_not_configured', 500);
  }

  const sigHeader = req.headers.get('x-razorpay-signature');
  const sigOk = await verifyRazorpaySignature(rawBody, sigHeader, secret);
  if (!sigOk) {
    // Per Razorpay best practice: reject silently with 400, no body details.
    return new Response('invalid signature', { status: 400 });
  }

  // ── Parse payload ────────────────────────────────────────────────────────
  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent;
  } catch {
    return errorResponse('invalid_json', 400);
  }
  if (!event?.event) {
    return errorResponse('missing_event_type', 400);
  }

  const payment = event.payload?.payment?.entity;
  if (!payment) {
    // Not a payment event — return 200 so Razorpay doesn't retry indefinitely.
    return jsonResponse({ ok: true, ignored: 'no_payment_entity' });
  }

  const db = adminClient();
  const capturedAtIso = new Date((event.created_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();

  // ── Dispatch by payment kind ─────────────────────────────────────────────
  const kind = payment.notes?.kind;

  if (kind === 'deposit') {
    const notes = extractDepositNotes(payment);
    if (!notes) return jsonResponse({ ok: true, ignored: 'malformed_deposit_notes' });

    if (event.event === 'payment.captured') {
      const result = await handleDepositCaptured(db, {
        paymentId:     payment.id,
        orderId:       payment.order_id,
        signature:     '',
        notes,
        capturedAtIso,
      });
      if (!result.ok) return errorResponse(result.error, 500);
      return jsonResponse({ ok: true, outcome: result });
    }

    if (event.event === 'payment.failed') {
      const result = await handleDepositFailed(db, {
        paymentId: payment.id,
        orderId:   payment.order_id,
        notes,
        reason:    payment.error_description ?? payment.error_reason ?? 'unknown',
      });
      if (!result.ok) return errorResponse(result.error, 500);
      return jsonResponse({ ok: true, outcome: 'failed_recorded' });
    }
  }

  if (kind === 'balance') {
    const notes = extractBalanceNotes(payment);
    if (!notes) return jsonResponse({ ok: true, ignored: 'malformed_balance_notes' });

    if (event.event === 'payment.captured') {
      // Fetch trip_starts_at from agreements for the T-12h check.
      let tripStartsAtIso: string | undefined;
      const { data: agreement } = await db
        .from('agreements')
        .select('trip_starts_at')
        .eq('booking_id', notes.booking_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (agreement?.trip_starts_at) {
        tripStartsAtIso = new Date(agreement.trip_starts_at).toISOString();
      }

      const result = await handleBalanceCaptured(db, {
        paymentId:       payment.id,
        orderId:         payment.order_id,
        notes,
        capturedAtIso,
        tripStartsAtIso,
      });
      if (!result.ok) return errorResponse(result.error, 500);
      return jsonResponse({ ok: true, outcome: result });
    }

    if (event.event === 'payment.failed') {
      // Mark initiated row as failed; booking stays in awaiting_balance/late_fee_due.
      await db
        .from('payment_events')
        .update({ status: 'failed', failed_reason: payment.error_description ?? 'unknown' })
        .eq('razorpay_order_id', payment.order_id);
      return jsonResponse({ ok: true, outcome: 'balance_failed_recorded' });
    }
  }

  if (kind === 'top_up') {
    const n = payment.notes;
    if (!n?.booking_id || !n.top_up_request_id) {
      return jsonResponse({ ok: true, ignored: 'malformed_topup_notes' });
    }

    if (event.event === 'payment.captured') {
      const result = await handleTopUpCaptured(db, {
        razorpay_payment_id: payment.id,
        razorpay_order_id:   payment.order_id,
        amount_paise:        Math.round(Number(payment.amount ?? 0)),
        booking_id:          n.booking_id,
        top_up_request_id:   n.top_up_request_id,
      } as TopUpCapturePayload);
      return jsonResponse({ ok: true, outcome: result });
    }

    if (event.event === 'payment.failed') {
      // Mark top-up as failed so buddy can retry.
      await db
        .from('top_up_requests')
        .update({ status: 'declined' })
        .eq('id', n.top_up_request_id)
        .in('status', ['approved', 'pending']);
      await db
        .from('payment_events')
        .update({ status: 'failed', failed_reason: payment.error_description ?? 'unknown' })
        .eq('razorpay_order_id', payment.order_id);
      return jsonResponse({ ok: true, outcome: 'topup_failed_recorded' });
    }
  }

  return jsonResponse({ ok: true, ignored: `kind_${kind ?? 'unknown'}_event_${event.event}` });
});
