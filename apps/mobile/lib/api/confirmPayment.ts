// ============================================================================
// CONFIRM-PAYMENT (client-confirm fallback for Razorpay)
// ============================================================================
// Calls the `confirm-payment` Edge Function with the signed values the
// Razorpay native SDK returns from a successful checkout. The function
// verifies the signature server-side (HMAC against KEY_SECRET) and runs
// the same capture handlers the webhook does, so the deposit/balance
// settles immediately even when no Razorpay webhook is configured
// (local dev, ongoing KYC, transient webhook outage, etc.).
//
// Calling this is idempotent w.r.t. a later webhook arrival — the
// capture handlers dedup on `razorpay_payment_id`.
// ============================================================================

import { supabase } from '../supabase';

export interface ConfirmPaymentRequest {
  booking_id:          string;
  kind:                'deposit' | 'balance';
  /** Required when kind === 'deposit'. */
  side?:               'traveler' | 'buddy';
  razorpay_order_id:   string;
  razorpay_payment_id: string;
  razorpay_signature:  string;
}

export interface ConfirmPaymentResult {
  ok:      true;
  outcome: unknown;
}

export class ConfirmPaymentError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ConfirmPaymentError';
  }
}

export async function confirmPayment(req: ConfirmPaymentRequest): Promise<ConfirmPaymentResult> {
  const { data, error } = await supabase.functions.invoke('confirm-payment', { body: req });

  if (error) {
    throw new ConfirmPaymentError(`confirm-payment failed: ${error.message}`);
  }
  const payload = data as Record<string, unknown>;
  if (!payload?.ok) {
    const msg = (payload?.error as string) ?? 'confirm-payment returned an invalid response';
    throw new ConfirmPaymentError(msg);
  }
  return { ok: true, outcome: payload.outcome };
}
