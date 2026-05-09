// ============================================================================
// TRIP LIFECYCLE API — Phase 4
// ============================================================================
// Thin wrappers around the qr-scan, end-trip, and submit-proofs Edge fns.
// ============================================================================

import { supabase } from '../supabase';
import type { ReconciliationSnapshot } from '../booking/reconciliationSnapshot';
import type { BookingState } from '../booking/stateMachine';

// ─── QR scan ─────────────────────────────────────────────────────────────────

export interface QrScanResult {
  ok:             boolean;
  booking_status: BookingState;
  trip_pot_paise: number;
  stubbed?:       boolean;
  error?:         'vpa_missing';
}

export async function scanQrToken(params: {
  bookingId: string;
  token:     string;
}): Promise<QrScanResult> {
  const { data, error } = await supabase.functions.invoke<QrScanResult>(
    'qr-scan',
    { body: { booking_id: params.bookingId, token: params.token } },
  );
  if (error) throw error;
  if (!data) throw new Error('qr-scan: empty response');
  return data;
}

export async function fetchTripQrToken(bookingId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('trip_qr_token')
    .eq('id', bookingId)
    .single();
  if (error) throw error;
  return data?.trip_qr_token ?? null;
}

// ─── End trip ────────────────────────────────────────────────────────────────

export interface EndTripResult {
  ok:             boolean;
  booking_status: BookingState;
  proofs_due_at:  string;
}

export async function endTrip(bookingId: string): Promise<EndTripResult> {
  const { data, error } = await supabase.functions.invoke<EndTripResult>(
    'end-trip',
    { body: { booking_id: bookingId } },
  );
  if (error) throw error;
  if (!data) throw new Error('end-trip: empty response');
  return data;
}

// ─── Submit proofs ────────────────────────────────────────────────────────────

export interface SubmitProofsResult {
  ok:             boolean;
  booking_status: BookingState;
  snapshot:       ReconciliationSnapshot;
}

export async function submitProofs(bookingId: string): Promise<SubmitProofsResult> {
  const { data, error } = await supabase.functions.invoke<SubmitProofsResult>(
    'submit-proofs',
    { body: { booking_id: bookingId } },
  );
  if (error) throw error;
  if (!data) throw new Error('submit-proofs: empty response');
  return data;
}

// ─── Payout dispatches ────────────────────────────────────────────────────────

export interface PayoutDispatch {
  id:                      string;
  booking_id:              string;
  kind:                    string;
  recipient_user_id:       string;
  gross_paise:             number;
  net_paise:               number;
  tds_paise?:              number;
  buffer_clawback_paise?:  number;
  deposit_component_paise?: number;
  status:                  'pending' | 'sent' | 'failed' | 'cancelled';
  failed_reason?:          string;
  initiated_at:            string;  // financial_core uses initiated_at, not created_at
  completed_at?:           string;
}

export async function fetchPayoutDispatches(bookingId: string): Promise<PayoutDispatch[]> {
  const { data, error } = await supabase
    .from('payout_dispatches')
    .select('*')
    .eq('booking_id', bookingId)
    .order('initiated_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PayoutDispatch[];
}
