// ============================================================================
// CANCELLATION API — Phase 3
// ============================================================================
// `cancelBooking` invokes the cancel-booking Edge Function which:
//   - Validates the booking is cancellable.
//   - Calls compute_cancellation_resolution_tx() in Postgres (atomic).
//   - Dispatches payout_dispatches rows (stub-safe).
//   - Returns { ok, booking_status, resolution }.
//
// `previewCancellation` is a dry-run using the TS pure helper — no network
// call, used for the "Here's what you'll get refunded" preview modal.
//
// `fetchCancellationResolution` reads the persisted JSONB from bookings for
// the cancellation receipt screens.
// ============================================================================

import { supabase } from '../supabase';
import {
  computeCancellationResolution,
  type CancellationResolution,
  type CancellationInputs,
} from '../booking/cancellationSnapshot';
import type { BookingState } from '../booking/stateMachine';

export type { CancellationResolution };

// ─── Cancel a booking ────────────────────────────────────────────────────────

export interface CancelBookingResult {
  ok:             boolean;
  booking_status: BookingState;
  resolution:     CancellationResolution;
}

export async function cancelBooking(params: {
  bookingId: string;
  reason?:   string;
}): Promise<CancelBookingResult> {
  const { data, error } = await supabase.functions.invoke<CancelBookingResult>(
    'cancel-booking',
    { body: { booking_id: params.bookingId, reason: params.reason } },
  );
  if (error) throw error;
  if (!data) throw new Error('cancel-booking: empty response');
  return data;
}

// ─── Preview (dry-run) ───────────────────────────────────────────────────────

/**
 * Computes a cancellation preview entirely client-side — no network.
 * Used for the "Here's what you'll get refunded" confirmation modal.
 * Snapshot inputs come from the booking + agreement (already in local state).
 */
export function previewCancellation(inputs: CancellationInputs): CancellationResolution {
  return computeCancellationResolution(inputs);
}

// ─── Read persisted resolution ───────────────────────────────────────────────

export async function fetchCancellationResolution(
  bookingId: string,
): Promise<CancellationResolution | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('cancelled_resolution_jsonb')
    .eq('id', bookingId)
    .single();

  if (error) throw error;
  return (data?.cancelled_resolution_jsonb as CancellationResolution | null) ?? null;
}
