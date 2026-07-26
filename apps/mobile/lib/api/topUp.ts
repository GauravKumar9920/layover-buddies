// ============================================================================
// TOP-UP API — Phase 4
// ============================================================================
// Buddy creates a top-up request; traveler approves or declines;
// traveler pays via Razorpay checkout; webhook captures it.
// ============================================================================

import { supabase } from '../supabase';
import { openRazorpayCheckout, type RazorpayOrder, type RazorpayPaymentResult } from './razorpayCheckout';
import { env } from '@/config/env';
import type { TopUpRequest } from '../hooks/useTrip';

// ── Buddy: request a top-up ────────────────────────────────────────────────

export interface RequestTopUpParams {
  bookingId:      string;
  requestedPaise: number;
  category:       string;
  purpose:        string;
}

export interface RequestTopUpResult {
  ok:              boolean;
  top_up_request:  TopUpRequest;
}

export async function requestTopUp(params: RequestTopUpParams): Promise<RequestTopUpResult> {
  const { data, error } = await supabase.functions.invoke<RequestTopUpResult>(
    'request-top-up',
    {
      body: {
        booking_id:      params.bookingId,
        requested_paise: params.requestedPaise,
        category:        params.category,
        purpose:         params.purpose,
      },
    },
  );
  if (error) throw error;
  if (!data) throw new Error('request-top-up: empty response');
  return data;
}

// ── Buddy: cancel a pending request ────────────────────────────────────────

export async function cancelTopUpRequest(topUpRequestId: string): Promise<void> {
  const { error } = await supabase
    .from('top_up_requests')
    .update({ status: 'cancelled' })
    .eq('id', topUpRequestId)
    .eq('status', 'pending');
  if (error) throw error;
}

// ── Traveler: approve or decline ───────────────────────────────────────────

export interface DecideTopUpParams {
  topUpRequestId: string;
  decision:       'approve' | 'decline';
}

export interface DecideTopUpResult {
  ok:              boolean;
  proceed:         boolean;
  status:          string;
  top_up_request_id: string;
}

export async function decideTopUp(params: DecideTopUpParams): Promise<DecideTopUpResult> {
  const { data, error } = await supabase.functions.invoke<DecideTopUpResult>(
    'decide-top-up',
    {
      body: {
        top_up_request_id: params.topUpRequestId,
        decision:          params.decision,
      },
    },
  );
  if (error) throw error;
  if (!data) throw new Error('decide-top-up: empty response');
  return data;
}

// ── Traveler: create Razorpay order for an approved top-up ─────────────────

export interface TopUpOrder extends RazorpayOrder {
  payment_event_id: string;
}

export async function createTopUpOrder(params: {
  bookingId:       string;
  topUpRequestId:  string;
}): Promise<TopUpOrder> {
  const { data, error } = await supabase.functions.invoke<{
    order_id: string;
    amount_paise: number;
    currency: string;
    payment_event_id: string;
  }>('create-topup-order', {
    body: {
      booking_id:        params.bookingId,
      top_up_request_id: params.topUpRequestId,
    },
  });
  if (error) throw error;
  if (!data) throw new Error('create-topup-order: empty response');
  return {
    order_id:         data.order_id,
    amount_paise:     data.amount_paise,
    currency:         data.currency,
    key_id:           env.RAZORPAY_KEY_ID,
    payment_event_id: data.payment_event_id,
  };
}

// ── Traveler: open Razorpay checkout for a top-up ──────────────────────────

export async function openTopUpCheckout(params: {
  order:          TopUpOrder;
  travelerName?:  string;
  travelerEmail?: string;
  purpose:        string;
}): Promise<RazorpayPaymentResult> {
  return openRazorpayCheckout({
    order:          params.order,
    travelerName:   params.travelerName,
    travelerEmail:  params.travelerEmail,
    tourName:       `Top-up: ${params.purpose}`,
  });
}

// ── REST reads ──────────────────────────────────────────────────────────────

/** Returns the single pending/approved top-up for a booking, or null. */
export async function fetchActiveTopUpRequest(bookingId: string): Promise<TopUpRequest | null> {
  const { data, error } = await supabase
    .from('top_up_requests')
    .select('*')
    .eq('booking_id', bookingId)
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as TopUpRequest | null;
}

export async function fetchTopUpHistory(bookingId: string): Promise<TopUpRequest[]> {
  const { data, error } = await supabase
    .from('top_up_requests')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TopUpRequest[];
}
