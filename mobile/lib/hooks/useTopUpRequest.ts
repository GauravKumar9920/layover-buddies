// ============================================================================
// useTopUpRequest — Phase 4 lightweight hook
// ============================================================================
// Used by the traveler's live-trip screen to drive the TopUpApprovalModal.
// Subscribes to top_up_requests WHERE booking_id=? AND status='pending'.
// Returns the single active request (if any) — the partial unique index
// guarantees at most one pending/approved per booking.
// ============================================================================

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { TopUpRequest } from './useTrip';

export interface UseTopUpRequestResult {
  activeRequest: TopUpRequest | null;
  loading:       boolean;
}

export function useTopUpRequest(bookingId: string | null): UseTopUpRequestResult {
  const [activeRequest, setActiveRequest] = useState<TopUpRequest | null>(null);
  const [loading,       setLoading]       = useState(true);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }
    let cancelled = false;

    async function fetch() {
      const { data } = await supabase
        .from('top_up_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setActiveRequest((data ?? null) as TopUpRequest | null);
        setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [bookingId]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase
      .channel(`topup_active_${bookingId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'top_up_requests',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const row = payload.new as TopUpRequest & { status: string };
          if (payload.eventType === 'DELETE') {
            setActiveRequest(null);
            return;
          }
          if (row.status === 'pending' || row.status === 'approved') {
            setActiveRequest(row);
          } else {
            // Status moved to captured/declined/expired/cancelled → no active request.
            setActiveRequest(prev => (prev?.id === row.id ? null : prev));
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId]);

  return { activeRequest, loading };
}
