// ============================================================================
// TRIP STAGES TESTS
// ============================================================================
// The invariant: every booking_status resolves to exactly one journey stage,
// or to a cancelled/disputed banner — never to nothing, never to two stages.
// ============================================================================

import { TRIP_STAGES, stageForState, isJourneyComplete } from '../tripStages';
import type { BookingState } from '../stateMachine';

// Mirror of the full booking_status enum in types/supabase.ts. If a migration
// adds a value, this list (and TRIP_STAGES) must be extended — the exhaustive
// check below will flag the omission.
const ALL_BOOKING_STATES: BookingState[] = [
  // canonical lifecycle
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
  // banners
  'disputed',
  'cancelled',
  'cancelled_no_pay',
  'cancelled_traveler_voluntary',
  'cancelled_buddy',
  'cancelled_force_majeure',
  'cancelled_pre_signing',
  'cancelled_no_deposit',
  // legacy (migrated, but the enum still permits them)
  'pending',
  'guide_accepted',
  'confirmed',
];

describe('TRIP_STAGES table', () => {
  it('has the 7 journey stages in order', () => {
    expect(TRIP_STAGES.map((s) => s.id)).toEqual([
      'request', 'agreement', 'deposits', 'balance', 'trip_day', 'wrap_up', 'review',
    ]);
  });

  it('no booking state appears in more than one stage', () => {
    const seen = new Set<BookingState>();
    for (const stage of TRIP_STAGES) {
      for (const state of stage.states) {
        expect(seen.has(state)).toBe(false);
        seen.add(state);
      }
    }
  });
});

describe('stageForState — exhaustive over the enum', () => {
  test.each(ALL_BOOKING_STATES)('%s resolves to a stage or a banner', (state) => {
    const pos = stageForState(state);
    if (pos.status === 'active') {
      expect(pos.index).toBeGreaterThanOrEqual(0);
      expect(pos.index).toBeLessThan(TRIP_STAGES.length);
      expect(TRIP_STAGES[pos.index].states).toContain(state);
    } else {
      expect(pos.index).toBe(-1);
      expect(['cancelled', 'disputed']).toContain(pos.status);
    }
  });

  it('every cancelled_* state (and bare cancelled) is a cancelled banner', () => {
    const cancelled = ALL_BOOKING_STATES.filter((s) => s.startsWith('cancelled'));
    expect(cancelled.length).toBe(7);
    for (const state of cancelled) {
      expect(stageForState(state)).toEqual({ index: -1, status: 'cancelled' });
    }
  });

  it('disputed is its own banner', () => {
    expect(stageForState('disputed')).toEqual({ index: -1, status: 'disputed' });
  });

  it('legacy states land on the stage of their migrated equivalent', () => {
    // pending → agreement_sent, guide_accepted → awaiting_deposits,
    // confirmed → balance_paid (20260503110100 data migration).
    expect(stageForState('pending').index).toBe(stageForState('agreement_sent').index);
    expect(stageForState('guide_accepted').index).toBe(stageForState('awaiting_deposits').index);
    expect(stageForState('confirmed').index).toBe(stageForState('balance_paid').index);
  });

  it('stage indexes are monotonic through the happy path', () => {
    const happyPath: BookingState[] = [
      'chat_open', 'agreement_sent', 'awaiting_deposits', 'awaiting_balance',
      'trip_ready', 'awaiting_proofs', 'completed',
    ];
    const indexes = happyPath.map((s) => stageForState(s).index);
    expect(indexes).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('isJourneyComplete', () => {
  it('only rated is complete — completed still awaits the rating', () => {
    expect(isJourneyComplete('rated')).toBe(true);
    expect(isJourneyComplete('completed')).toBe(false);
    expect(isJourneyComplete('in_progress')).toBe(false);
  });
});
