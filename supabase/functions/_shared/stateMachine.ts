// ============================================================================
// BOOKING STATE MACHINE — Edge Function copy
// ============================================================================
// Verbatim port of mobile/lib/booking/stateMachine.ts so that Edge Functions
// (sign-agreement, razorpay-webhook) decide booking-status transitions using
// the EXACT same reducer the client uses. Kept as a separate file rather than
// imported because:
//   1. The client version pulls Database['public']['Enums']['booking_status']
//      from the giant generated supabase.ts — bundling it into a Deno function
//      blows up the deploy size.
//   2. Edge runtimes don't share a tsconfig with the mobile app, so the path
//      alias `@/types/supabase` cannot resolve.
//
// The two files MUST stay in sync. The Phase 2 deno test
// `webhook-signature.test.ts` is an admittedly-thin guard against drift —
// Phase 3 should add a DRY check (e.g. a build script that diffs the two).
// ============================================================================

export type BookingState =
  | 'chat_open'
  | 'agreement_drafting'
  | 'agreement_sent'
  | 'agreement_signed_traveler'
  | 'agreement_signed_buddy'
  | 'awaiting_deposits'
  | 'deposits_held'
  | 'awaiting_balance'
  | 'late_fee_due'
  | 'balance_paid'
  | 'trip_ready'
  | 'in_progress'
  | 'awaiting_proofs'
  | 'reconciling'
  | 'completed'
  | 'rated'
  | 'disputed'
  | 'cancelled'
  | 'cancelled_no_pay'
  | 'cancelled_traveler_voluntary'
  | 'cancelled_buddy'
  | 'cancelled_force_majeure'
  | 'cancelled_pre_signing'
  | 'cancelled_no_deposit'
  // Legacy values still permitted by the DB enum
  | 'pending'
  | 'guide_accepted'
  | 'confirmed';

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

export type GuardContext = {
  bothSignaturesPresent: boolean;
  bothDepositsHeld: boolean;
};

export type TransitionResult =
  | { ok: true; next: BookingState }
  | { ok: false; error: 'illegal_transition'; from: BookingState; event: BookingEvent };

type GuardFn = (event: BookingEvent, ctx: GuardContext) => boolean;
type NextFn = (event: BookingEvent, ctx: GuardContext) => BookingState;

interface TransitionRule {
  event: BookingEvent['kind'];
  guard?: GuardFn;
  next: BookingState | NextFn;
}

function resolveNext(next: BookingState | NextFn, event: BookingEvent, ctx: GuardContext): BookingState {
  return typeof next === 'function' ? next(event, ctx) : next;
}

const TRANSITIONS = new Map<BookingState, TransitionRule[]>([
  ['chat_open', [
    { event: 'guide_starts_drafting', next: 'agreement_drafting' },
    { event: 'cancel',                next: 'cancelled_pre_signing' },
  ]],
  ['agreement_drafting', [
    { event: 'guide_sends_agreement', next: 'agreement_sent' },
    { event: 'cancel',                next: 'cancelled_pre_signing' },
  ]],
  ['agreement_sent', [
    { event: 'traveler_signs', next: 'agreement_signed_traveler' },
    { event: 'buddy_signs',    next: 'agreement_signed_buddy' },
    { event: 'cancel',         next: 'cancelled_pre_signing' },
  ]],
  ['agreement_signed_traveler', [
    { event: 'buddy_signs', guard: (_, ctx) => ctx.bothSignaturesPresent, next: 'awaiting_deposits' },
    { event: 'cancel', next: 'cancelled_pre_signing' },
  ]],
  ['agreement_signed_buddy', [
    { event: 'traveler_signs', guard: (_, ctx) => ctx.bothSignaturesPresent, next: 'awaiting_deposits' },
    { event: 'cancel', next: 'cancelled_pre_signing' },
  ]],
  ['awaiting_deposits', [
    { event: 'deposit_captured', guard: (_, ctx) => ctx.bothDepositsHeld,  next: 'deposits_held' },
    { event: 'deposit_captured', guard: (_, ctx) => !ctx.bothDepositsHeld, next: 'awaiting_deposits' },
    { event: 'deposit_window_expired', next: 'cancelled_no_deposit' },
    { event: 'cancel',                 next: 'cancelled_pre_signing' },
  ]],
  ['deposits_held', []],
  ['awaiting_balance', [
    { event: 'balance_captured',   next: 'balance_paid' },
    { event: 't_minus_72_reached', next: 'late_fee_due' },
    { event: 'cancel', guard: (e) => e.kind === 'cancel' && e.actor === 'traveler', next: 'cancelled_traveler_voluntary' },
    { event: 'cancel', guard: (e) => e.kind === 'cancel' && e.actor === 'buddy',    next: 'cancelled_buddy' },
    { event: 'force_majeure_verified', next: 'cancelled_force_majeure' },
  ]],
  ['late_fee_due', [
    { event: 'balance_captured',   next: 'balance_paid' },
    { event: 't_minus_12_reached', next: 'cancelled_no_pay' },
    { event: 'cancel', guard: (e) => e.kind === 'cancel' && e.actor === 'traveler', next: 'cancelled_traveler_voluntary' },
    { event: 'cancel', guard: (e) => e.kind === 'cancel' && e.actor === 'buddy',    next: 'cancelled_buddy' },
    { event: 'force_majeure_verified', next: 'cancelled_force_majeure' },
  ]],
  ['balance_paid', [
    { event: 't_minus_12_reached', next: 'trip_ready' },
    { event: 'cancel', guard: (e) => e.kind === 'cancel' && e.actor === 'traveler', next: 'cancelled_traveler_voluntary' },
    { event: 'cancel', guard: (e) => e.kind === 'cancel' && e.actor === 'buddy',    next: 'cancelled_buddy' },
    { event: 'force_majeure_verified', next: 'cancelled_force_majeure' },
  ]],
  ['trip_ready', [
    { event: 'qr_scanned', next: 'in_progress' },
    { event: 'cancel', guard: (e) => e.kind === 'cancel' && e.actor === 'buddy', next: 'cancelled_buddy' },
    { event: 'cancel',
      guard: (e) => e.kind === 'cancel' && (e.actor === 'traveler' || e.actor === 'platform' || e.actor === 'system'),
      next:  'cancelled_traveler_voluntary' },
    { event: 'force_majeure_verified', next: 'cancelled_force_majeure' },
  ]],
  ['in_progress', [
    { event: 'buddy_ends_trip', next: 'awaiting_proofs' },
    { event: 'dispute_raised',  next: 'disputed' },
  ]],
  ['awaiting_proofs', [
    { event: 'proofs_uploaded', next: 'reconciling' },
    { event: 'dispute_raised',  next: 'disputed' },
  ]],
  ['reconciling', [
    { event: 'reconciliation_complete', next: 'completed' },
  ]],
  ['completed', [
    { event: 'rating_submitted', next: 'rated' },
  ]],
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

// Legacy state forward-compat shims — must match mobile/lib/booking/stateMachine.ts.
TRANSITIONS.set('pending',        TRANSITIONS.get('agreement_sent')!);
TRANSITIONS.set('guide_accepted', TRANSITIONS.get('awaiting_deposits')!);
TRANSITIONS.set('confirmed',      TRANSITIONS.get('balance_paid')!);

export function transition(state: BookingState, event: BookingEvent, ctx: GuardContext): TransitionResult {
  const rules = TRANSITIONS.get(state) ?? [];
  for (const rule of rules) {
    if (rule.event !== event.kind) continue;
    if (rule.guard !== undefined && !rule.guard(event, ctx)) continue;
    return { ok: true, next: resolveNext(rule.next, event, ctx) };
  }
  return { ok: false, error: 'illegal_transition', from: state, event };
}
