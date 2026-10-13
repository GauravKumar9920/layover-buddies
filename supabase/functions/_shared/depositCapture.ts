// ============================================================================
// DEPOSIT CAPTURE BUSINESS LOGIC
// ============================================================================
// Pure-ish module with the database-mutation flow that runs when a Razorpay
// deposit `payment.captured` event arrives. Extracted from the webhook
// handler so it can be exercised by `depositCaptureFlow.test.ts` against a
// mocked Supabase client without binding to the HTTP serve loop.
//
// Contract (see plan §"razorpay-webhook" step 4):
//   1. Mark payment_events row 'captured'.
//   2. Mark deposits row 'held'.
//   3. Re-read both deposits rows; compute bothDepositsHeld.
//   4. Run state-machine transition. If guard passes and result is
//      'deposits_held', write that AND immediately write 'awaiting_balance'
//      (the documented Phase 1 backend-only second jump).
//   5. Idempotent: re-firing the same payment_id returns early without
//      double-writes.
// ============================================================================

import {
  transition,
  type BookingEvent,
  type BookingState,
  type GuardContext,
} from './stateMachine.ts';
import { handlePaymentFailed } from './paymentFailure.ts';

export interface DepositNotes {
  booking_id: string;
  kind: 'deposit';
  side: 'traveler' | 'buddy';
  deposit_id: string;
}

export interface CapturedPayload {
  paymentId:        string;       // razorpay_payment_id
  orderId:          string;       // razorpay_order_id
  signature:        string;       // razorpay_signature (off the payment entity, when present)
  notes:            DepositNotes;
  capturedAtIso:    string;
}

export interface FailedPayload {
  paymentId:    string;
  orderId:      string;
  notes:        DepositNotes;
  reason:       string;
}

/** Subset of supabase-js used by this module. Keeps the test mock simple. */
export interface SupabaseLike {
  from(table: string): any;
}

export type CaptureOutcome =
  | { ok: true; type: 'idempotent' }
  | { ok: true; type: 'first_deposit'; bookingStatus: BookingState }
  | { ok: true; type: 'both_deposits_held'; bookingStatus: 'awaiting_balance' }
  | { ok: false; error: string };

/**
 * Process a Razorpay deposit `payment.captured` event.
 * `db` is a thin wrapper that only needs to support .from(table).select/update/etc.
 *  In production this is the supabase-js admin client; in tests it's a mock.
 */
export async function handleDepositCaptured(
  db: SupabaseLike,
  payload: CapturedPayload,
): Promise<CaptureOutcome> {
  // ── 1. Idempotency check ─────────────────────────────────────────────────
  const existing = await db
    .from('payment_events')
    .select('id, status, razorpay_payment_id')
    .eq('razorpay_order_id', payload.orderId)
    .maybeSingle();

  if (existing.error) return { ok: false, error: `db_error: ${existing.error.message}` };
  if (!existing.data) return { ok: false, error: 'payment_event_not_found' };
  if (existing.data.status === 'refunded') return { ok: true, type: 'idempotent' };
  const alreadyCaptured = existing.data.status === 'captured';
  if (alreadyCaptured) {
    if (existing.data.razorpay_payment_id !== payload.paymentId) return { ok: false, error: 'order_already_captured' };
    const [deposits, booking] = await Promise.all([
      db.from('deposits').select('side, status').eq('booking_id', payload.notes.booking_id),
      db.from('bookings').select('status').eq('id', payload.notes.booking_id).maybeSingle(),
    ]);
    if (deposits.error || booking.error) return { ok: false, error: 'capture_recovery_unavailable' };
    if (!booking.data) return { ok: false, error: 'booking_not_found' };
    // A ledger write can succeed before a later write fails. Replayed webhooks
    // must finish those writes, while leaving completed/refunded trips alone.
    const ownHeld = deposits.data?.some((row: { side: string; status: string }) => row.side === payload.notes.side && row.status === 'held');
    const bothHeld = deposits.data?.filter((row: { status: string }) => row.status === 'held').length === 2;
    if (!['awaiting_deposits', 'deposits_held'].includes(booking.data.status)
      || (booking.data.status === 'awaiting_deposits' && ownHeld && !bothHeld)) {
      return { ok: true, type: 'idempotent' };
    }
  }

  // ── 2. Mark payment_events captured ──────────────────────────────────────
  const peUpdate = alreadyCaptured ? { data: existing.data, error: null } : await db
    .from('payment_events')
    .update({
      status:               'captured',
      razorpay_payment_id:  payload.paymentId,
      razorpay_signature:   payload.signature,
      captured_at:          payload.capturedAtIso,
      failed_reason:        null,
    })
    .eq('id', existing.data.id)
    .in('status', ['initiated', 'failed'])
    .select('id')
    .maybeSingle();

  if (peUpdate.error) return { ok: false, error: `db_error: ${peUpdate.error.message}` };
  if (!peUpdate.data) return { ok: false, error: 'payment_changed_during_capture' };

  // ── 3. Mark deposit held ─────────────────────────────────────────────────
  const depositUpdate = await db
    .from('deposits')
    .update({
      status:              'held',
      razorpay_payment_id: payload.paymentId,
      held_at:             payload.capturedAtIso,
    })
    .eq('id', payload.notes.deposit_id)
    .eq('booking_id', payload.notes.booking_id)
    .eq('side', payload.notes.side)
    .in('status', ['pending', 'held'])
    .select('id')
    .maybeSingle();

  if (depositUpdate.error) {
    return { ok: false, error: `db_error: ${depositUpdate.error.message}` };
  }
  if (!depositUpdate.data) return { ok: false, error: 'deposit_changed_during_capture' };

  // ── 4. Re-read both deposits → compute bothDepositsHeld ──────────────────
  const depositsList = await db
    .from('deposits')
    .select('side, status')
    .eq('booking_id', payload.notes.booking_id);

  if (depositsList.error) {
    return { ok: false, error: `db_error: ${depositsList.error.message}` };
  }

  const heldRows = (depositsList.data ?? []).filter(
    (r: { status: string }) => r.status === 'held',
  );
  const bothDepositsHeld = heldRows.length === 2;

  // ── 5. Read booking, run state-machine transition ────────────────────────
  const bookingRead = await db
    .from('bookings')
    .select('status')
    .eq('id', payload.notes.booking_id)
    .maybeSingle();

  if (bookingRead.error) return { ok: false, error: `db_error: ${bookingRead.error.message}` };
  if (!bookingRead.data) return { ok: false, error: 'booking_not_found' };

  const currentStatus = bookingRead.data.status as BookingState;
  const event: BookingEvent = currentStatus === 'deposits_held'
    ? { kind: 'deposits_recovered' }
    : { kind: 'deposit_captured', side: payload.notes.side };
  const ctx: GuardContext = { bothDepositsHeld, bothSignaturesPresent: true };
  const result = transition(currentStatus, event, ctx);

  if (!result.ok) {
    return { ok: false, error: `illegal_transition_from_${currentStatus}` };
  }

  // First deposit: state is unchanged (`awaiting_deposits` → `awaiting_deposits`)
  if (result.next === 'awaiting_deposits') {
    return { ok: true, type: 'first_deposit', bookingStatus: 'awaiting_deposits' };
  }

  // Second deposit: write deposits_held, then immediately write awaiting_balance
  // (documented Phase 1 backend-only second jump from stateMachine.ts).
  // If this Edge function dies between the two writes, the booking is frozen in
  // deposits_held with no outgoing events. The cron_deposits_held_sweep job
  // (migration 20260613_deposits_held_sweep) advances any booking stuck in
  // deposits_held >2 min with both deposits genuinely held.
  if (currentStatus === 'awaiting_deposits') {
    const w1 = await db
      .from('bookings')
      .update({ status: 'deposits_held' })
      .eq('id', payload.notes.booking_id)
      .eq('status', 'awaiting_deposits')
      .select('id')
      .maybeSingle();
    if (w1.error) return { ok: false, error: `db_error: ${w1.error.message}` };
    if (!w1.data) return { ok: false, error: 'booking_changed_during_capture' };
  }

  const w2 = await db
    .from('bookings')
    .update({ status: 'awaiting_balance' })
    .eq('id', payload.notes.booking_id)
    .eq('status', 'deposits_held')
    .select('id')
    .maybeSingle();

  if (w2.error) return { ok: false, error: `db_error: ${w2.error.message}` };
  if (!w2.data) return { ok: false, error: 'booking_changed_during_capture' };

  return { ok: true, type: 'both_deposits_held', bookingStatus: 'awaiting_balance' };
}

/**
 * Process a Razorpay deposit `payment.failed` event.
 * Marks the payment_events row failed; leaves deposits row alone (still pending).
 * Phase 3 cron `bookings.deposit_window_expire` cleans up after 24h.
 */
export async function handleDepositFailed(
  db: SupabaseLike,
  payload: FailedPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return await handlePaymentFailed(db, payload);
}
