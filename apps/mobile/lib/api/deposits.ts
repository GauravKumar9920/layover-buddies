// ============================================================================
// DEPOSITS API — Edge-function client + REST reads (Phase 2)
// ============================================================================
// `createDepositOrder` calls the create-deposit-order Edge Function which
// reserves a Razorpay order, persists the deposit row in pending state, and
// returns the order IDs the native checkout sheet needs.
//
// `openDepositCheckout` re-uses the existing Razorpay native module wrapper
// from payments.ts so we don't fork the resolver / web fallback logic.
//
// IMPORTANT: After checkout returns, callers do NOT advance booking status
// or write to deposits — the razorpay-webhook is the source of truth for
// capture confirmation. Callers should poll `useAgreement().deposits` (kept
// fresh by the Realtime sub) until the row flips to status='held'.
// ============================================================================

import { supabase } from '../supabase';
import {
  openRazorpayCheckout,
  type RazorpayOrder,
  type RazorpayPaymentResult,
} from './razorpayCheckout';
import type { Database } from '@/types/supabase';

export type Deposit = Database['public']['Tables']['deposits']['Row'];
export type DepositSide = Database['public']['Enums']['deposit_side'];

export interface DepositOrder extends RazorpayOrder {
  deposit_id: string;
  reused?:    boolean;
}

export async function createDepositOrder(
  bookingId: string,
  side: DepositSide,
): Promise<DepositOrder> {
  const { data, error } = await supabase.functions.invoke('create-deposit-order', {
    body: { booking_id: bookingId, side },
  });

  if (error) {
    throw new Error(`Deposit order failed: ${error.message}`);
  }

  const payload = data as Record<string, unknown>;
  if (!payload?.order_id) {
    throw new Error((payload?.error as string) ?? 'create-deposit-order returned an invalid response');
  }

  return {
    order_id:     payload.order_id as string,
    amount_paise: payload.amount_paise as number,
    currency:     (payload.currency as string) ?? 'INR',
    key_id:       payload.key_id as string,
    deposit_id:   payload.deposit_id as string,
    reused:       (payload.reused as boolean | undefined) ?? false,
  };
}

/**
 * Open the Razorpay native checkout sheet for a deposit.
 * Resolves with payment IDs on success — but we DON'T use them to advance
 * booking state. The webhook does that. This function only awaits the
 * sheet's success/cancel signal so the UI can transition to its
 * "Confirming with payment processor…" spinner.
 */
export async function openDepositCheckout(params: {
  order: DepositOrder;
  travelerName?: string;
  travelerEmail?: string;
}): Promise<RazorpayPaymentResult> {
  return openRazorpayCheckout({
    order:         params.order,
    travelerName:  params.travelerName,
    travelerEmail: params.travelerEmail,
    tourName:      'Refundable deposit',
  });
}

export async function fetchDeposits(bookingId: string): Promise<Deposit[]> {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .order('side');   // deterministic: buddy < traveler alphabetically

  if (error) throw error;
  return data ?? [];
}
