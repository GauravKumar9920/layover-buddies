// Both facades deliberately load one canonical source; fixture coverage protects its contract.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import * as edge from '../_shared/stateMachine.ts';
import * as mobile from '../../../apps/mobile/lib/booking/stateMachine.ts';

type AnyState = edge.BookingState;
type AnyEvent = edge.BookingEvent;

const ALL_STATES: AnyState[] = [
  'chat_open',
  'agreement_drafting',
  'agreement_sent',
  'agreement_signed_traveler',
  'agreement_signed_buddy',
  'awaiting_deposits',
  'deposits_held',
  'awaiting_balance',
  'late_fee_due',
  'balance_paid',
  'trip_ready',
  'in_progress',
  'awaiting_proofs',
  'reconciling',
  'completed',
  'rated',
  'disputed',
  'cancelled',
  'cancelled_no_pay',
  'cancelled_traveler_voluntary',
  'cancelled_buddy',
  'cancelled_force_majeure',
  'cancelled_pre_signing',
  'cancelled_no_deposit',
  'no_show_traveler',
  'no_show_buddy',
  'pending',
  'guide_accepted',
  'confirmed',
];

// Every event variant, with all actor/side permutations spelled out.
const ALL_EVENTS: AnyEvent[] = [
  { kind: 'guide_starts_drafting' },
  { kind: 'guide_sends_agreement' },
  { kind: 'traveler_signs' },
  { kind: 'buddy_signs' },
  { kind: 'deposit_captured', side: 'traveler' },
  { kind: 'deposit_captured', side: 'buddy' },
  { kind: 'deposits_recovered' },
  { kind: 'dispute_resolved', outcome: 'resume' },
  { kind: 'dispute_resolved', outcome: 'settled' },
  { kind: 'dispute_resolved', outcome: 'cancel' },
  { kind: 'balance_captured' },
  { kind: 't_minus_72_reached' },
  { kind: 't_minus_12_reached' },
  { kind: 'qr_scanned' },
  { kind: 'buddy_ends_trip' },
  { kind: 'proofs_uploaded' },
  { kind: 'reconciliation_complete' },
  { kind: 'rating_submitted' },
  { kind: 'cancel', actor: 'traveler', reason: 'parity' },
  { kind: 'cancel', actor: 'buddy', reason: 'parity' },
  { kind: 'cancel', actor: 'platform', reason: 'parity' },
  { kind: 'cancel', actor: 'system', reason: 'parity' },
  { kind: 'force_majeure_verified' },
  { kind: 'dispute_raised' },
  { kind: 'no_show_reported' },
  { kind: 'no_show_marked', party: 'traveler' },
  { kind: 'no_show_marked', party: 'buddy' },
  { kind: 'deposit_window_expired' },
];

const ALL_CONTEXTS: edge.GuardContext[] = [
  { bothSignaturesPresent: true, bothDepositsHeld: true, disputeWindowOpen: true },
  { bothSignaturesPresent: false, bothDepositsHeld: false },
  { bothSignaturesPresent: true, bothDepositsHeld: false },
  { bothSignaturesPresent: false, bothDepositsHeld: true },
  { bothSignaturesPresent: true, bothDepositsHeld: true },
];

Deno.test('edge and mobile state machines agree on every transition', () => {
  let combinations = 0;
  for (const state of ALL_STATES) {
    for (const event of ALL_EVENTS) {
      for (const ctx of ALL_CONTEXTS) {
        const e = edge.transition(state, event, ctx);
        const m = mobile.transition(
          state as Parameters<typeof mobile.transition>[0],
          event as Parameters<typeof mobile.transition>[1],
          ctx,
        );
        assertEquals(
          e,
          m,
          `divergence at state=${state} event=${JSON.stringify(event)} ctx=${JSON.stringify(ctx)}: ` +
            `edge=${JSON.stringify(e)} mobile=${JSON.stringify(m)}`,
        );
        combinations++;
      }
    }
  }
  // Guard the enumeration itself: if someone empties the lists the test
  // must fail rather than trivially pass.
  assertEquals(combinations, ALL_STATES.length * ALL_EVENTS.length * ALL_CONTEXTS.length);
});

Deno.test('platform and system cancellations never penalise the traveler', () => {
  // Regression pin for the original money bug: in any state where a
  // platform/system cancel is legal, it must resolve to force-majeure
  // economics, never to a traveler-fault terminal state.
  for (const state of ALL_STATES) {
    for (const actor of ['platform', 'system'] as const) {
      const event: AnyEvent = { kind: 'cancel', actor, reason: 'parity' };
      for (const ctx of ALL_CONTEXTS) {
        const result = edge.transition(state, event, ctx);
        if (result.ok && result.next.startsWith('cancelled')) {
          const acceptable = result.next === 'cancelled_force_majeure' ||
            result.next === 'cancelled_pre_signing'; // pre-money: nothing to refund
          if (!acceptable) {
            throw new Error(
              `state=${state}: ${actor} cancel resolved to ${result.next} — traveler penalised for a platform decision`,
            );
          }
        }
      }
    }
  }
});
