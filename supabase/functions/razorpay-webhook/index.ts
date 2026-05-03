// ============================================================================
// RAZORPAY-WEBHOOK (Phase 2 Edge Function — the brain)
// ============================================================================
// Verifies the X-Razorpay-Signature HMAC, then dispatches deposit-related
// payment events into the depositCapture business logic. All booking-status
// transitions caused by Razorpay events run through this function.
//
// Configure in Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://<project>.supabase.co/functions/v1/razorpay-webhook
//   Events: payment.captured, payment.failed
//   Secret: set the same value as RAZORPAY_WEBHOOK_SECRET (via `supabase
//           secrets set RAZORPAY_WEBHOOK_SECRET=<value>`)
//
// Idempotency is guaranteed by the dedup check inside `handleDepositCaptured`
// (looks up payment_events.razorpay_payment_id and short-circuits on
// re-delivery). Razorpay retries 5 times over 24h on non-200; every step
// in our handler is safe to repeat.
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

interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  notes?: Partial<DepositNotes>;
  error_description?: string;
  error_reason?: string;
}

interface RazorpayWebhookEvent {
  event: string;                                            // 'payment.captured' etc.
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
    side:       n.side,
    deposit_id: n.deposit_id,
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

  const notes = extractDepositNotes(payment);
  if (!notes) {
    // Unrelated to deposits (e.g. balance/top-up payments will arrive in Phase 3).
    return jsonResponse({ ok: true, ignored: 'not_a_deposit_event' });
  }

  const db = adminClient();
  const capturedAtIso = new Date((event.created_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();

  // ── Dispatch ─────────────────────────────────────────────────────────────
  if (event.event === 'payment.captured') {
    const result = await handleDepositCaptured(db, {
      paymentId:     payment.id,
      orderId:       payment.order_id,
      signature:     sigHeader ?? '',
      notes,
      capturedAtIso,
    });
    if (!result.ok) {
      // Internal failure — Razorpay will retry, which is exactly what we want
      // for transient DB errors. Idempotency keeps us safe on the retry.
      return errorResponse(result.error, 500);
    }
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

  // Other event types (refund.processed, payout.processed, etc.) land in Phase 3+.
  return jsonResponse({ ok: true, ignored: `event_${event.event}` });
});
