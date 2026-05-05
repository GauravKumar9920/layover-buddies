// ============================================================================
// BALANCE API — Phase 3
// ============================================================================
// `createBalanceOrder` calls the create-balance-order Edge Function which
// computes the balance amount (subtotal + GST ± late fee), creates a Razorpay
// order, and returns the order IDs for native checkout.
//
// `openBalanceCheckout` re-uses the existing Razorpay native module wrapper.
//
// After checkout returns, callers do NOT advance booking status directly —
// the razorpay-webhook is the source of truth. Callers should poll
// `useTrip().booking.status` (kept fresh by Realtime) until it flips to
// 'balance_paid' or 'trip_ready'.
// ============================================================================

import { supabase } from '../supabase';
import {
  openRazorpayCheckout,
  type RazorpayOrder,
  type RazorpayPaymentResult,
} from './payments';

export interface BalanceOrder extends RazorpayOrder {
  payment_event_id: string;
  trip_starts_at?:  string;
  reused?:          boolean;
}

export async function createBalanceOrder(bookingId: string): Promise<BalanceOrder> {
  const { data, error } = await supabase.functions.invoke<BalanceOrder>(
    'create-balance-order',
    { body: { booking_id: bookingId } },
  );
  if (error) throw error;
  if (!data) throw new Error('create-balance-order: empty response');
  return data;
}

export async function openBalanceCheckout(params: {
  order:          BalanceOrder;
  travelerName?:  string;
  travelerEmail?: string;
}): Promise<RazorpayPaymentResult> {
  return openRazorpayCheckout({
    order:          params.order,
    travelerName:   params.travelerName,
    travelerEmail:  params.travelerEmail,
    tourName:       'Trip balance payment',
  });
}
