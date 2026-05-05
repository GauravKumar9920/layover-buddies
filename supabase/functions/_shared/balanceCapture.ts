// ============================================================================
// BALANCE CAPTURE BUSINESS LOGIC — Phase 3
// ============================================================================
// Mirrors depositCapture.ts: extracted so it can be unit-tested against a
// mocked Supabase client without binding to the webhook HTTP serve loop.
//
// Contract (see plan §"razorpay-webhook" balance extension):
//   1. Idempotency check on payment_events.razorpay_payment_id.
//   2. Mark payment_events row 'captured'.
//   3. Run state-machine: awaiting_balance/late_fee_due → balance_paid.
//   4. If now > trip_starts_at - 12h (T-12h already past), also run
//      t_minus_12_reached → trip_ready immediately.
//      On trip_ready, generate trip_qr_token.
//   5. All idempotent.
// ============================================================================

import {
  transition,
  type BookingEvent,
  type BookingState,
} from './stateMachine.ts';

export interface BalanceNotes {
  booking_id:            string;
  kind:                  'balance';
  is_late_fee_component: boolean;
}

export interface BalanceCapturedPayload {
  paymentId:             string;
  orderId:               string;
  notes:                 BalanceNotes;
  capturedAtIso:         string;
  /** Authoritative trip start time read from agreements, if available. */
  tripStartsAtIso?:      string;
}

export interface SupabaseLike {
  from(table: string): any;   // intentionally permissive — matches supabase-js
  rpc(fn: string, params: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

export type BalanceCaptureOutcome =
  | { ok: true;  type: 'idempotent' }
  | { ok: true;  type: 'balance_paid';   bookingStatus: 'balance_paid' }
  | { ok: true;  type: 'trip_ready';     bookingStatus: 'trip_ready' }
  | { ok: false; error: string };

/**
 * Process a Razorpay balance `payment.captured` event.
 */
export async function handleBalanceCaptured(
  db: SupabaseLike,
  payload: BalanceCapturedPayload,
): Promise<BalanceCaptureOutcome> {
  // ── 1. Idempotency ───────────────────────────────────────────────────────
  const { data: existing, error: exErr } = await db
    .from('payment_events')
    .select('id, status')
    .eq('razorpay_payment_id', payload.paymentId)
    .maybeSingle();

  if (exErr) return { ok: false, error: `db_error: ${exErr.message}` };
  if (existing?.status === 'captured') return { ok: true, type: 'idempotent' };

  // ── 2. Mark payment_events captured ─────────────────────────────────────
  const { error: peErr } = await db
    .from('payment_events')
    .update({
      status:              'captured',
      razorpay_payment_id: payload.paymentId,
      captured_at:         payload.capturedAtIso,
    })
    .eq('razorpay_order_id', payload.orderId);

  if (peErr) return { ok: false, error: `db_error: ${peErr.message}` };

  // ── 3. Read booking current status ──────────────────────────────────────
  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('id, status')
    .eq('id', payload.notes.booking_id)
    .maybeSingle();

  if (bErr || !booking) return { ok: false, error: 'booking_not_found' };

  const currentStatus = booking.status as BookingState;

  // ── 4. State-machine: advance to balance_paid ────────────────────────────
  const balanceEvent: BookingEvent = { kind: 'balance_captured' };
  const balanceResult = transition(currentStatus, balanceEvent, {});

  if (!balanceResult.ok) {
    return { ok: false, error: `illegal_transition_from_${currentStatus}_on_balance_captured` };
  }

  const { error: bpErr } = await db
    .from('bookings')
    .update({ status: 'balance_paid' })
    .eq('id', payload.notes.booking_id);

  if (bpErr) return { ok: false, error: `db_error: ${bpErr.message}` };

  // ── 5. T-12h check: if already inside 12h window, jump to trip_ready ─────
  const now = new Date();
  let alreadyInsideTMinus12 = false;

  if (payload.tripStartsAtIso) {
    const tripStart = new Date(payload.tripStartsAtIso);
    const msUntilTrip = tripStart.getTime() - now.getTime();
    alreadyInsideTMinus12 = msUntilTrip < 12 * 60 * 60 * 1000;
  }

  if (alreadyInsideTMinus12) {
    const t12Event: BookingEvent = { kind: 't_minus_12_reached' };
    const t12Result = transition('balance_paid', t12Event, {});

    if (t12Result.ok && t12Result.next === 'trip_ready') {
      // Generate a QR token and advance to trip_ready in one update.
      const qrToken = crypto.randomUUID();
      const { error: trErr } = await db
        .from('bookings')
        .update({ status: 'trip_ready', trip_qr_token: qrToken })
        .eq('id', payload.notes.booking_id);

      if (trErr) {
        // Non-fatal: balance_paid is the safe fallback; cron will handle trip_ready.
        console.warn('balanceCapture: failed to advance to trip_ready:', trErr.message);
      } else {
        return { ok: true, type: 'trip_ready', bookingStatus: 'trip_ready' };
      }
    }
  }

  return { ok: true, type: 'balance_paid', bookingStatus: 'balance_paid' };
}
