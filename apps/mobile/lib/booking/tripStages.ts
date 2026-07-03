// ============================================================================
// TRIP STAGES — booking_status → journey stage mapping
// ============================================================================
// Collapses the 25-state booking lifecycle into the 7 stages a human thinks
// in: Request → Agreement → Deposits → Balance → Trip day → Wrap-up → Review.
// Pure TypeScript, zero React imports — consumed by TripTimeline and tested
// in __tests__/tripStages.test.ts.
//
// Cancelled/disputed bookings don't live on the rail at all — they resolve to
// a banner status so the UI can show a terminal notice instead of a stage dot.
// ============================================================================

import type { BookingState } from './stateMachine';

export type TripStageId =
  | 'request'
  | 'agreement'
  | 'deposits'
  | 'balance'
  | 'trip_day'
  | 'wrap_up'
  | 'review';

export interface TripStage {
  id: TripStageId;
  /** Short label rendered under the stage dot (DM Mono eyebrow style). */
  label: string;
  /** Every booking_status that belongs to this stage. */
  states: BookingState[];
}

// Legacy enum values (pending / guide_accepted / confirmed) were migrated by
// 20260503110100_bookings_status_data_migration.sql to agreement_sent /
// awaiting_deposits / balance_paid. They keep the same stage as their
// canonical equivalents so a stale row still renders somewhere sensible.
export const TRIP_STAGES: TripStage[] = [
  { id: 'request',   label: 'Request',   states: ['chat_open'] },
  { id: 'agreement', label: 'Agreement', states: ['agreement_drafting', 'agreement_sent', 'agreement_signed_traveler', 'agreement_signed_buddy', 'pending'] },
  { id: 'deposits',  label: 'Deposits',  states: ['awaiting_deposits', 'deposits_held', 'guide_accepted'] },
  { id: 'balance',   label: 'Balance',   states: ['awaiting_balance', 'late_fee_due', 'balance_paid', 'confirmed'] },
  { id: 'trip_day',  label: 'Trip day',  states: ['trip_ready', 'in_progress'] },
  { id: 'wrap_up',   label: 'Wrap-up',   states: ['awaiting_proofs', 'reconciling'] },
  { id: 'review',    label: 'Review',    states: ['completed', 'rated'] },
];

export type TripStageStatus = 'active' | 'cancelled' | 'disputed';

export interface TripStagePosition {
  /**
   * Index into TRIP_STAGES of the current stage. -1 when the booking is off
   * the rail (status !== 'active') — check `status` before using it.
   */
  index: number;
  status: TripStageStatus;
}

const STATE_TO_STAGE_INDEX = new Map<BookingState, number>(
  TRIP_STAGES.flatMap((stage, index) =>
    stage.states.map((state): [BookingState, number] => [state, index]),
  ),
);

const CANCELLED_PREFIX = 'cancelled';

/** Resolve a booking status to its journey-stage position (or banner status). */
export function stageForState(state: BookingState): TripStagePosition {
  if (state === 'disputed') return { index: -1, status: 'disputed' };
  if (state.startsWith(CANCELLED_PREFIX)) return { index: -1, status: 'cancelled' };

  const index = STATE_TO_STAGE_INDEX.get(state);
  // Unknown value from a newer DB enum — park it on the first stage rather
  // than crash; the CTA layer independently degrades to an empty CTA.
  return { index: index ?? 0, status: 'active' };
}

/**
 * True once the journey has nothing left to do (`rated`). `completed` still
 * has the rating step ahead, so it stays "current" on the Review stage.
 */
export function isJourneyComplete(state: BookingState): boolean {
  return state === 'rated';
}
