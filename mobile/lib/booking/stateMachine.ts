// ============================================================================
// BOOKING STATE MACHINE — Phase 1
// ============================================================================
// Pure TypeScript reducer; zero React Native imports.
// Implements the 25-state lifecycle from §3 of
// docs/financial/financial-model-handoff.md.
//
// Usage:
//   const result = transition(currentState, event, guardCtx);
//   if (result.ok) { save result.next to DB } else { log illegal transition }
//
// Note on deposits_held → awaiting_balance:
//   This transition has no corresponding BookingEvent — it is triggered
//   automatically by the Razorpay deposit webhook handler (Phase 2) immediately
//   after writing deposits_held. The state machine does not model it; the
//   backend service writes awaiting_balance directly after deposits_held.
// ============================================================================

import type { Database } from '@/types/supabase';

export type BookingState = Database['public']['Enums']['booking_status'];

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

export type BookingEvent =
  | { kind: 'guide_starts_drafting' }
  | { kind: 'guide_sends_agreement' }
  | { kind: 'traveler_signs' }
  | { kind: 'buddy_signs' }
  | { kind: 'deposit_captured'; side: 'traveler' | 'buddy' }
  | { kind: 'balance_captured' }
  | { kind: 't_minus_72_reached' }
  | { kind: 't_minus_12_reached' }
  | { kind: 'qr_scanned' }
  | { kind: 'buddy_ends_trip' }
  | { kind: 'proofs_uploaded' }
  | { kind: 'reconciliation_complete' }
  | { kind: 'rating_submitted' }
  | { kind: 'cancel'; actor: 'traveler' | 'buddy' | 'platform' | 'system'; reason: string }
  | { kind: 'force_majeure_verified' }
  | { kind: 'dispute_raised' }
  | { kind: 'deposit_window_expired' };

// ─────────────────────────────────────────────────────────────────────────────
// Guard context — values the caller must compute from DB state before calling
// ─────────────────────────────────────────────────────────────────────────────

export type GuardContext = {
  /**
   * true when both agreements.traveler_signed_at and buddy_signed_at are set.
   *
   * IMPORTANT — evaluation order: callers must write the triggering action to
   * the DB FIRST (e.g. set buddy_signed_at), then read the updated row to
   * compute this field, and THEN call `transition()`. The guard reflects the
   * post-write state of the DB, not the state before the action.
   */
  bothSignaturesPresent: boolean;
  /**
   * true when both deposits.status = 'held' rows exist for this booking.
   *
   * Same evaluation-order contract as bothSignaturesPresent: capture the
   * deposit in the DB first, then derive this value from the new DB state
   * before calling `transition()`.
   */
  bothDepositsHeld: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────────────

export type TransitionResult =
  | { ok: true; next: BookingState }
  | { ok: false; error: 'illegal_transition'; from: BookingState; event: BookingEvent };

// ─────────────────────────────────────────────────────────────────────────────
// Internal — transition rule shape
// ─────────────────────────────────────────────────────────────────────────────

type GuardFn = (event: BookingEvent, ctx: GuardContext) => boolean;
type NextFn  = (event: BookingEvent, ctx: GuardContext) => BookingState;

interface TransitionRule {
  event: BookingEvent['kind'];
  guard?: GuardFn;
  next: BookingState | NextFn;
}

function resolveNext(
  next: BookingState | NextFn,
  event: BookingEvent,
  ctx: GuardContext,
): BookingState {
  return typeof next === 'function' ? next(event, ctx) : next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition table
// ─────────────────────────────────────────────────────────────────────────────
// Rules are evaluated in order; first rule whose guard passes wins.
// Absence of a matching rule → illegal_transition.

const TRANSITIONS = new Map<BookingState, TransitionRule[]>([

  // ── 1. chat_open ─────────────────────────────────────────────────────────
  ['chat_open', [
    { event: 'guide_starts_drafting', next: 'agreement_drafting' },
    { event: 'cancel',               next: 'cancelled_pre_signing' },
  ]],

  // ── 2. agreement_drafting ─────────────────────────────────────────────────
  ['agreement_drafting', [
    { event: 'guide_sends_agreement', next: 'agreement_sent' },
    { event: 'cancel',               next: 'cancelled_pre_signing' },
  ]],

  // ── 3. agreement_sent ─────────────────────────────────────────────────────
  // Both parties can sign in any order (parallel signing pattern).
  // The guard on the parallel-state rules handles the "second signer" case.
  ['agreement_sent', [
    { event: 'traveler_signs', next: 'agreement_signed_traveler' },
    { event: 'buddy_signs',    next: 'agreement_signed_buddy' },
    { event: 'cancel',         next: 'cancelled_pre_signing' },
  ]],

  // ── 4. agreement_signed_traveler ─────────────────────────────────────────
  // Traveler has signed; waiting for buddy.
  // Only the event where BOTH are now signed (guard=true) advances to
  // awaiting_deposits. If guard is false the event is illegal from this state.
  ['agreement_signed_traveler', [
    {
      event: 'buddy_signs',
      guard: (_, ctx) => ctx.bothSignaturesPresent,
      next:  'awaiting_deposits',
    },
    { event: 'cancel', next: 'cancelled_pre_signing' },
  ]],

  // ── 5. agreement_signed_buddy ────────────────────────────────────────────
  // Buddy has signed; waiting for traveler.
  ['agreement_signed_buddy', [
    {
      event: 'traveler_signs',
      guard: (_, ctx) => ctx.bothSignaturesPresent,
      next:  'awaiting_deposits',
    },
    { event: 'cancel', next: 'cancelled_pre_signing' },
  ]],

  // ── 6. awaiting_deposits ─────────────────────────────────────────────────
  // 24-hour window for both sides to pay ₹500 deposit.
  // First deposit: guard=false → self-transition (no state change).
  // Second deposit: guard=true → deposits_held.
  // Note: both rules match 'deposit_captured'; order matters — guard=true first.
  ['awaiting_deposits', [
    {
      event: 'deposit_captured',
      guard: (_, ctx) => ctx.bothDepositsHeld,
      next:  'deposits_held',
    },
    {
      event: 'deposit_captured',
      guard: (_, ctx) => !ctx.bothDepositsHeld,
      next:  'awaiting_deposits', // first deposit only — state unchanged
    },
    { event: 'deposit_window_expired', next: 'cancelled_no_deposit' },
    { event: 'cancel',                 next: 'cancelled_pre_signing' },
  ]],

  // ── 7. deposits_held ─────────────────────────────────────────────────────
  // Both ₹500 deposits are in escrow. Booking committed.
  // deposits_held → awaiting_balance is a backend-only write triggered by
  // the Razorpay webhook handler (Phase 2). The state machine intentionally
  // has no outgoing events for this state in Phase 1 — the Phase 2 webhook
  // handler writes awaiting_balance directly after confirming deposits_held,
  // so no client-side event is ever dispatched from this state.
  ['deposits_held', []],

  // ── 8. awaiting_balance ──────────────────────────────────────────────────
  // Default confirmation state. T–72h cron fires t_minus_72_reached.
  ['awaiting_balance', [
    { event: 'balance_captured',       next: 'balance_paid' },
    { event: 't_minus_72_reached',     next: 'late_fee_due' },
    {
      event: 'cancel',
      guard: (e) => e.kind === 'cancel' && e.actor === 'traveler',
      next:  'cancelled_traveler_voluntary',
    },
    {
      event: 'cancel',
      guard: (e) => e.kind === 'cancel' && e.actor === 'buddy',
      next:  'cancelled_buddy',
    },
    { event: 'force_majeure_verified', next: 'cancelled_force_majeure' },
  ]],

  // ── 9. late_fee_due ──────────────────────────────────────────────────────
  // T–72h passed, balance unpaid. ₹1,000 late fee accruing.
  ['late_fee_due', [
    { event: 'balance_captured',   next: 'balance_paid' },   // pays balance + late fee
    { event: 't_minus_12_reached', next: 'cancelled_no_pay' },
    {
      event: 'cancel',
      guard: (e) => e.kind === 'cancel' && e.actor === 'traveler',
      next:  'cancelled_traveler_voluntary',
    },
    {
      event: 'cancel',
      guard: (e) => e.kind === 'cancel' && e.actor === 'buddy',
      next:  'cancelled_buddy',
    },
    { event: 'force_majeure_verified', next: 'cancelled_force_majeure' },
  ]],

  // ── 10. balance_paid ─────────────────────────────────────────────────────
  // Full balance in escrow. T–12h cron moves to trip_ready.
  ['balance_paid', [
    { event: 't_minus_12_reached',    next: 'trip_ready' },
    {
      event: 'cancel',
      guard: (e) => e.kind === 'cancel' && e.actor === 'traveler',
      next:  'cancelled_traveler_voluntary',
    },
    {
      event: 'cancel',
      guard: (e) => e.kind === 'cancel' && e.actor === 'buddy',
      next:  'cancelled_buddy',
    },
    { event: 'force_majeure_verified', next: 'cancelled_force_majeure' },
  ]],

  // ── 11. trip_ready ────────────────────────────────────────────────────────
  // Balance paid; awaiting trip day. Traveler shows QR → buddy scans.
  ['trip_ready', [
    { event: 'qr_scanned', next: 'in_progress' },
    {
      event: 'cancel',
      guard: (e) => e.kind === 'cancel' && e.actor === 'buddy',
      next:  'cancelled_buddy',
    },
    {
      event: 'cancel',
      guard: (e) => e.kind === 'cancel' && (e.actor === 'traveler' || e.actor === 'platform' || e.actor === 'system'),
      next:  'cancelled_traveler_voluntary',
    },
    { event: 'force_majeure_verified', next: 'cancelled_force_majeure' },
  ]],

  // ── 12. in_progress ──────────────────────────────────────────────────────
  // QR scanned; trip pot released to buddy UPI. Day underway.
  ['in_progress', [
    { event: 'buddy_ends_trip', next: 'awaiting_proofs' },
    { event: 'dispute_raised',  next: 'disputed' },
  ]],

  // ── 13. awaiting_proofs ──────────────────────────────────────────────────
  // Buddy tapped "End trip"; uploading UPI payment proofs.
  ['awaiting_proofs', [
    { event: 'proofs_uploaded', next: 'reconciling' },
    { event: 'dispute_raised',  next: 'disputed' },
  ]],

  // ── 14. reconciling ──────────────────────────────────────────────────────
  // All proofs uploaded; calculating final payout amounts.
  ['reconciling', [
    { event: 'reconciliation_complete', next: 'completed' },
  ]],

  // ── 15. completed ─────────────────────────────────────────────────────────
  // All payouts and refunds processed. Rating link sent at T+3h.
  ['completed', [
    { event: 'rating_submitted', next: 'rated' },
  ]],

  // ── Terminal states ────────────────────────────────────────────────────────
  // No outgoing transitions from any terminal state.
  ['rated',                       []],
  ['disputed',                    []],
  ['cancelled',                   []],
  ['cancelled_no_pay',            []],
  ['cancelled_traveler_voluntary', []],
  ['cancelled_buddy',             []],
  ['cancelled_force_majeure',     []],
  ['cancelled_pre_signing',       []],
  ['cancelled_no_deposit',        []],

]);

// ── Legacy state forward-compat shims ─────────────────────────────────────────
// All pre-Phase-1 rows were migrated by 20260503110100_bookings_status_data_migration.sql:
//   pending        → agreement_sent
//   guide_accepted → awaiting_deposits
//   confirmed      → balance_paid
//
// These entries let the reducer handle any row that survived migration (e.g. a
// manual write, a test fixture, or a stale mobile client that skipped the DB
// upgrade) without silently getting stuck. They share the same rule array
// references as their canonical equivalents so there is no logic duplication.
// (Populated after Map construction so the canonical entries exist to reference.)
TRANSITIONS.set('pending',       TRANSITIONS.get('agreement_sent')!);
TRANSITIONS.set('guide_accepted', TRANSITIONS.get('awaiting_deposits')!);
TRANSITIONS.set('confirmed',      TRANSITIONS.get('balance_paid')!);

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a booking event to the current state and return the next state.
 *
 * @param state   Current booking_status from the DB.
 * @param event   The event that occurred.
 * @param ctx     Guard context — must be computed fresh from DB before calling.
 * @returns       { ok: true, next } on success; { ok: false, error, from, event } on failure.
 */
export function transition(
  state: BookingState,
  event: BookingEvent,
  ctx: GuardContext,
): TransitionResult {
  const rules = TRANSITIONS.get(state) ?? [];

  for (const rule of rules) {
    if (rule.event !== event.kind) continue;
    if (rule.guard !== undefined && !rule.guard(event, ctx)) continue;
    return { ok: true, next: resolveNext(rule.next, event, ctx) };
  }

  return { ok: false, error: 'illegal_transition', from: state, event };
}

/**
 * Returns true if *any* rule exists for the given state+eventKind combination,
 * regardless of guard conditions.  Useful for disabling UI buttons.
 */
export function canTransition(
  state: BookingState,
  eventKind: BookingEvent['kind'],
): boolean {
  return (TRANSITIONS.get(state) ?? []).some((r) => r.event === eventKind);
}

// ─────────────────────────────────────────────────────────────────────────────
// State classification — used by UI for partitioning bookings into upcoming/past
// and deciding when an action (chat, cancel, review) makes sense.
//
// These exist because pre-Phase-1 the UI hardcoded literals like ['pending',
// 'guide_accepted', 'confirmed', 'in_progress'], which silently drop every new
// Phase 1+ state (chat_open, agreement_*, awaiting_*, balance_paid, trip_ready,
// etc.). The result: a brand-new traveler with a brand-new booking sees
// "No trips yet" — confirmed live during the 2026-05-14 review pass.
// Centralising the predicate here keeps the legacy and modern paths consistent.
// ─────────────────────────────────────────────────────────────────────────────

/** Terminal states — no further transitions are possible. */
export const TERMINAL_BOOKING_STATES = new Set<BookingState>([
  'rated',
  'disputed',
  'cancelled',
  'cancelled_no_pay',
  'cancelled_traveler_voluntary',
  'cancelled_buddy',
  'cancelled_force_majeure',
  'cancelled_pre_signing',
  'cancelled_no_deposit',
]);

/**
 * Past states — terminal states plus `completed`. From the user's perspective
 * a `completed` booking belongs in "past trips" even though the state machine
 * still allows `completed → rated` via `rating_submitted`.
 */
export const PAST_BOOKING_STATES = new Set<BookingState>([
  ...TERMINAL_BOOKING_STATES,
  'completed',
]);

/** Returns true for any booking that should appear in "Upcoming trips". */
export function isUpcomingBookingState(state: BookingState): boolean {
  return !PAST_BOOKING_STATES.has(state);
}

/** Returns true for any booking the user could still take action on (chat, etc.). */
export function isActiveBookingState(state: BookingState): boolean {
  return !TERMINAL_BOOKING_STATES.has(state);
}
