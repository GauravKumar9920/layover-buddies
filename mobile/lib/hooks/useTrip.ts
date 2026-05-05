// ============================================================================
// useTrip — Phase 4 hook
// ============================================================================
// Single hook covering every entity displayed across the Phase 3+4 trip
// lifecycle screens (balance → QR → in-trip → proofs → receipt).
//
// Mirrors the useAgreement pattern: initial fetch + four Realtime channels.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import type { BookingState } from '../booking/stateMachine';
import type { CancellationResolution } from '../booking/cancellationSnapshot';
import type { ExpenseProof } from '../api/expenseProofs';
import type { PayoutDispatch } from '../api/tripLifecycle';

export interface TripBooking {
  id:                      string;
  traveler_id:             string;
  guide_id:                string;
  status:                  BookingState;
  late_fee_paise:          number;
  trip_qr_token:           string | null;
  proofs_due_at:           string | null;
  reconciled_at:           string | null;
  completed_at:            string | null;
  cancelled_at:            string | null;
  cancelled_resolution_jsonb: CancellationResolution | null;
  trip_pot_released_at:    string | null;
}

export interface TripAgreement {
  id:                      string;
  buddy_fee_paise:         number;
  itinerary_fund_paise:    number;
  buffer_paise:            number;
  traveler_subtotal_paise: number;
  traveler_gst_paise:      number;
  traveler_total_paise:    number;
  trip_starts_at:          string;
  trip_ends_at:            string | null;
}

export interface TopUpRequest {
  id:                  string;
  booking_id:          string;
  created_by_user_id:  string;
  requested_paise:     number;
  category:            string;
  purpose:             string;
  status:              string;
  expires_at:          string;
  traveler_decided_at: string | null;
  razorpay_order_id:   string | null;
}

export interface UseTripResult {
  booking:                 TripBooking | null;
  agreement:               TripAgreement | null;
  topUpRequests:           TopUpRequest[];
  expenseProofs:           ExpenseProof[];
  payoutDispatches:        PayoutDispatch[];
  cancellationResolution:  CancellationResolution | null;
  loading:                 boolean;
  error:                   string | null;
  reload:                  () => Promise<void>;
}

export function useTrip(bookingId: string | null): UseTripResult {
  const [booking,          setBooking]          = useState<TripBooking | null>(null);
  const [agreement,        setAgreement]        = useState<TripAgreement | null>(null);
  const [topUpRequests,    setTopUpRequests]    = useState<TopUpRequest[]>([]);
  const [expenseProofs,    setExpenseProofs]    = useState<ExpenseProof[]>([]);
  const [payoutDispatches, setPayoutDispatches] = useState<PayoutDispatch[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!bookingId) return;
    try {
      setLoading(true);
      setError(null);

      const [bRes, aRes, tuRes, epRes, pdRes] = await Promise.all([
        supabase.from('bookings').select(
          'id, traveler_id, guide_id, status, late_fee_paise, trip_qr_token, ' +
          'proofs_due_at, reconciled_at, completed_at, cancelled_at, ' +
          'cancelled_resolution_jsonb, trip_pot_released_at',
        ).eq('id', bookingId).single(),

        supabase.from('agreements').select(
          'id, buddy_fee_paise, itinerary_fund_paise, buffer_paise, ' +
          'traveler_subtotal_paise, traveler_gst_paise, traveler_total_paise, ' +
          'trip_starts_at, trip_ends_at',
        ).eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(1).single(),

        supabase.from('top_up_requests').select('*')
          .eq('booking_id', bookingId).order('created_at', { ascending: false }),

        supabase.from('expense_proofs').select('*')
          .eq('booking_id', bookingId).order('created_at', { ascending: true }),

        supabase.from('payout_dispatches').select('*')
          .eq('booking_id', bookingId).order('created_at', { ascending: true }),
      ]);

      if (bRes.error)  throw bRes.error;
      if (aRes.error && aRes.error.code !== 'PGRST116') throw aRes.error; // 116 = no rows

      setBooking(bRes.data as unknown as TripBooking);
      setAgreement(aRes.data as TripAgreement | null);
      setTopUpRequests((tuRes.data ?? []) as TopUpRequest[]);
      setExpenseProofs((epRes.data ?? []) as ExpenseProof[]);
      setPayoutDispatches((pdRes.data ?? []) as PayoutDispatch[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  // Initial load.
  useEffect(() => { reload(); }, [reload]);

  // Realtime subscriptions — four channels.
  useEffect(() => {
    if (!bookingId) return;

    const channels = [
      supabase.channel(`trip_booking_${bookingId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'bookings',
          filter: `id=eq.${bookingId}`,
        }, (p) => {
          setBooking(prev => prev ? { ...prev, ...(p.new as TripBooking) } : p.new as TripBooking);
        })
        .subscribe(),

      supabase.channel(`trip_topup_${bookingId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'top_up_requests',
          filter: `booking_id=eq.${bookingId}`,
        }, () => { reload(); })
        .subscribe(),

      supabase.channel(`trip_proofs_${bookingId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'expense_proofs',
          filter: `booking_id=eq.${bookingId}`,
        }, () => { reload(); })
        .subscribe(),

      supabase.channel(`trip_dispatches_${bookingId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'payout_dispatches',
          filter: `booking_id=eq.${bookingId}`,
        }, () => { reload(); })
        .subscribe(),
    ];

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [bookingId, reload]);

  const cancellationResolution = booking?.cancelled_resolution_jsonb ?? null;

  return {
    booking,
    agreement,
    topUpRequests,
    expenseProofs,
    payoutDispatches,
    cancellationResolution,
    loading,
    error,
    reload,
  };
}
