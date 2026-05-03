// ============================================================================
// useAgreement — Phase 2 Realtime hook
// ============================================================================
// One hook that surfaces every piece of state Phase 2 needs to render the
// agreement viewer + the deposit CTAs:
//   - the latest agreement row for a booking
//   - the cost line items for that agreement
//   - both deposit rows (traveler + buddy)
//   - the live booking row (so status changes from the webhook auto-rerender)
//
// Subscribes to postgres_changes on all four tables. This is the in-place
// replacement for the deferred-to-Phase-5 push notifications: when the
// webhook flips a deposit to 'held', or the sign-agreement Edge function
// updates the booking, both parties' viewers re-render within ~1s.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import {
  fetchAgreementByBooking,
  fetchLineItemsByAgreement,
  type Agreement,
  type CostLineItem,
} from '../api/agreements';
import { fetchDeposits, type Deposit } from '../api/deposits';
import { fetchBookingById } from '../api/bookings';
import type { Booking } from '@/types';

export interface UseAgreementResult {
  booking:   Booking | null;
  agreement: Agreement | null;
  lineItems: CostLineItem[];
  deposits:  Deposit[];
  loading:   boolean;
  error:     string | null;
  reload:    () => Promise<void>;
}

export function useAgreement(bookingId: string): UseAgreementResult {
  const [booking,   setBooking]   = useState<Booking | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [lineItems, setLineItems] = useState<CostLineItem[]>([]);
  const [deposits,  setDeposits]  = useState<Deposit[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Track agreement_id so the line-items channel filter can use it.
  const currentAgreementIdRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!bookingId) {
      setBooking(null); setAgreement(null); setLineItems([]); setDeposits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [bk, agr, deps] = await Promise.all([
        fetchBookingById(bookingId),
        fetchAgreementByBooking(bookingId),
        fetchDeposits(bookingId),
      ]);
      setBooking(bk);
      setAgreement(agr);
      setDeposits(deps);
      currentAgreementIdRef.current = agr?.id ?? null;

      if (agr) {
        const items = await fetchLineItemsByAgreement(agr.id);
        setLineItems(items);
      } else {
        setLineItems([]);
      }
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load agreement');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    let mounted = true;
    reload();

    const channel = supabase
      .channel(`agreement:${bookingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        () => { if (mounted) reload(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agreements', filter: `booking_id=eq.${bookingId}` },
        () => { if (mounted) reload(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deposits', filter: `booking_id=eq.${bookingId}` },
        () => { if (mounted) reload(); },
      )
      // cost_line_items is keyed on agreement_id, not booking_id — but we
      // refetch all four when any change fires, so this catches it via the
      // agreements channel above when a save touches the parent's updated_at.
      // (A direct subscription would need a dynamic filter as the agreement
      //  is created; this is simpler and the cost is one extra refetch.)
      .subscribe((status) => {
        if (!mounted) return;
        if (status === 'SUBSCRIBED') {
          setError(null); return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError('Live updates interrupted. Pull to refresh.');
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [bookingId, reload]);

  return { booking, agreement, lineItems, deposits, loading, error, reload };
}
