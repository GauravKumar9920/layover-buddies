// ============================================================================
// BOOKING CTA MAPPING — status × viewer → button label + route
// ============================================================================
// Centralises the Phase 2 status-conditional CTA logic for both the traveler
// trip-detail screen and the buddy booking-detail screen, and the chat
// composer "📋 Agreement" button. Pure function — no React imports — so it
// can be tested with describe.each() in cta.test.ts.
//
// See plan §"CTA wiring" for the table.
// ============================================================================

import type { BookingState } from './stateMachine';

export type Viewer = 'traveler' | 'buddy';

export interface BookingCta {
  /** Display label for the button. Empty string → no CTA shown. */
  label: string;
  /**
   * Route the user is taken to on tap. `null` → CTA is informational only
   * (e.g. "Waiting for guide to draft agreement").
   */
  route: { pathname: string; params?: Record<string, string> } | null;
  /** True when the CTA is visible but disabled (greyed out). */
  disabled: boolean;
  /** Variant — drives styling in the consuming screen. */
  variant: 'primary' | 'secondary' | 'info' | 'success';
}

const VIEWER_AGREEMENT: Record<BookingState, Partial<Record<Viewer, BookingCta>>> = {
  chat_open: {
    traveler: { label: 'Waiting for guide to draft agreement', route: null, disabled: true,  variant: 'info' },
    buddy:    { label: 'Draft agreement', route: { pathname: '/(guide)/bookings/agreement-draft/[bookingId]' }, disabled: false, variant: 'primary' },
  },
  agreement_drafting: {
    traveler: { label: 'Guide is drafting your agreement', route: null, disabled: true, variant: 'info' },
    buddy:    { label: 'Continue drafting',                route: { pathname: '/(guide)/bookings/agreement-draft/[bookingId]' }, disabled: false, variant: 'primary' },
  },
  agreement_sent: {
    traveler: { label: 'Review and sign', route: { pathname: '/(shared)/agreements/[bookingId]' }, disabled: false, variant: 'primary' },
    buddy:    { label: 'Review and sign', route: { pathname: '/(shared)/agreements/[bookingId]' }, disabled: false, variant: 'primary' },
  },
  agreement_signed_traveler: {
    traveler: { label: 'Waiting for guide to sign', route: null, disabled: true, variant: 'info' },
    buddy:    { label: 'Review and sign',           route: { pathname: '/(shared)/agreements/[bookingId]' }, disabled: false, variant: 'primary' },
  },
  agreement_signed_buddy: {
    traveler: { label: 'Review and sign',              route: { pathname: '/(shared)/agreements/[bookingId]' }, disabled: false, variant: 'primary' },
    buddy:    { label: 'Waiting for traveler to sign', route: null, disabled: true, variant: 'info' },
  },
  awaiting_deposits: {
    traveler: { label: 'Pay ₹500 deposit', route: { pathname: '/(shared)/agreements/[bookingId]' }, disabled: false, variant: 'primary' },
    buddy:    { label: 'Pay ₹500 deposit', route: { pathname: '/(shared)/agreements/[bookingId]' }, disabled: false, variant: 'primary' },
  },
  deposits_held: {
    traveler: { label: 'Deposits secured. Balance flow opens soon.', route: null, disabled: true, variant: 'success' },
    buddy:    { label: 'Deposits secured. Awaiting traveler balance.', route: null, disabled: true, variant: 'success' },
  },
  awaiting_balance: {
    traveler: { label: 'Deposits secured. Balance flow opens soon.', route: null, disabled: true, variant: 'success' },
    buddy:    { label: 'Deposits secured. Awaiting traveler balance.', route: null, disabled: true, variant: 'success' },
  },
  // ── States past awaiting_balance — Phase 2 doesn't surface a CTA here ──
  // (the existing pre-Phase-2 trip-detail screens already render their own
  //  status-specific CTAs for these states; we return the empty CTA so the
  //  Phase 2 block hides itself).
  late_fee_due:                 {},
  balance_paid:                 {},
  trip_ready:                   {},
  in_progress:                  {},
  awaiting_proofs:              {},
  reconciling:                  {},
  completed:                    {},
  rated:                        {},
  disputed:                     {},
  cancelled:                    {},
  cancelled_no_pay:             {},
  cancelled_traveler_voluntary: {},
  cancelled_buddy:              {},
  cancelled_force_majeure:      {},
  cancelled_pre_signing:        {},
  cancelled_no_deposit:         {},
  // Legacy enum values still permitted by the DB enum.
  pending:        {},
  guide_accepted: {},
  confirmed:      {},
};

const EMPTY_CTA: BookingCta = { label: '', route: null, disabled: true, variant: 'info' };

/**
 * Returns the CTA descriptor for a given booking status × viewer.
 * Returns an empty-label CTA (label = '') when no Phase 2 CTA applies.
 */
export function getBookingCta(status: BookingState, viewer: Viewer): BookingCta {
  return VIEWER_AGREEMENT[status]?.[viewer] ?? EMPTY_CTA;
}
