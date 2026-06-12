// ============================================================================
// BOOKING CTA MAPPING — status × viewer → button label + route
// ============================================================================
// Centralises the Phase 2+3+4 status-conditional CTA logic for both the
// traveler trip-detail screen and the buddy booking-detail screen, and the
// chat composer "📋 Agreement" button. Pure function — no React imports — so
// it can be tested with describe.each() in cta.test.ts.
//
// Phase 2 covers: chat_open → awaiting_balance.
// Phase 3 covers: late_fee_due → balance_paid.
// Phase 4 covers: trip_ready → rated, all cancelled_* states.
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
  variant: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger';
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
    // `deposits_held` means BOTH ₹500 deposits are in escrow — the state
    // machine only enters it on the second `deposit_captured` (guard:
    // bothDepositsHeld). A single deposit self-loops in `awaiting_deposits`.
    // The backend webhook advances deposits_held → awaiting_balance moments
    // later (and the deposits-held sweep cron covers a dead webhook), so this
    // is a transient "all locked in" state: nobody owes anything here. Both
    // viewers get a reassuring confirmation that links back to the agreement
    // for review. (Fixed per APP_REVIEW §1.1 — this file previously showed the
    // buddy a "Pay ₹500 deposit" button for a payment they had already made.)
    traveler: { label: 'Deposits secured', route: { pathname: '/(shared)/agreements/[bookingId]' }, disabled: false, variant: 'success' },
    buddy:    { label: 'Deposits secured', route: { pathname: '/(shared)/agreements/[bookingId]' }, disabled: false, variant: 'success' },
  },
  awaiting_balance: {
    // Phase 3: balance payment is now a real screen.
    traveler: { label: 'Pay trip balance', route: { pathname: '/(traveler)/trips/balance/[bookingId]' }, disabled: false, variant: 'primary' },
    buddy:    { label: 'Awaiting traveler balance', route: null, disabled: true, variant: 'info' },
  },
  // ── Phase 3: balance + late-fee states ─────────────────────────────────────
  late_fee_due: {
    // Balance + late fee bundled. The fee amount is configurable in
    // platform_settings (₹0 during early access), so the label stays generic —
    // the balance screen shows the exact rupee figure.
    traveler: { label: 'Pay balance + late fee', route: { pathname: '/(traveler)/trips/balance/[bookingId]' }, disabled: false, variant: 'warning' },
    buddy:    { label: 'Awaiting traveler balance', route: null, disabled: true,  variant: 'info' },
  },
  balance_paid: {
    // Countdown shown by the screen itself; this is just the navigator anchor.
    traveler: { label: 'Trip confirmed',      route: null, disabled: true, variant: 'success' },
    buddy:    { label: 'Trip confirmed',      route: null, disabled: true, variant: 'success' },
  },

  // ── Phase 4: trip lifecycle states ──────────────────────────────────────────
  trip_ready: {
    // Traveler shows QR; buddy scans it.
    traveler: { label: 'Show your QR code',  route: { pathname: '/(traveler)/trips/qr/[bookingId]' },        disabled: false, variant: 'primary' },
    buddy:    { label: 'Scan traveler QR',   route: { pathname: '/(guide)/bookings/qr-scan/[bookingId]' },   disabled: false, variant: 'primary' },
  },
  in_progress: {
    traveler: { label: 'Trip in progress',   route: { pathname: '/(traveler)/trips/live/[id]' },             disabled: false, variant: 'info' },
    buddy:    { label: 'Trip in progress',   route: { pathname: '/(guide)/bookings/in-trip/[bookingId]' },   disabled: false, variant: 'info' },
  },
  awaiting_proofs: {
    traveler: { label: 'Buddy is wrapping up', route: null, disabled: true, variant: 'info' },
    buddy:    { label: 'Upload expense proofs', route: { pathname: '/(guide)/bookings/upload-proofs/[bookingId]' }, disabled: false, variant: 'primary' },
  },
  reconciling: {
    traveler: { label: 'Settling up…', route: null, disabled: true, variant: 'info' },
    buddy:    { label: 'Settling up…', route: null, disabled: true, variant: 'info' },
  },
  completed: {
    traveler: { label: 'See day receipt',    route: { pathname: '/(traveler)/trips/receipt/[bookingId]' },   disabled: false, variant: 'success' },
    buddy:    { label: 'See payout receipt', route: { pathname: '/(guide)/bookings/receipt/[bookingId]' },   disabled: false, variant: 'success' },
  },
  rated: {
    traveler: { label: 'Thanks for the rating!', route: null, disabled: true, variant: 'success' },
    buddy:    { label: 'Trip complete',           route: null, disabled: true, variant: 'success' },
  },
  disputed: {
    traveler: { label: 'Under review with support', route: null, disabled: true, variant: 'info' },
    buddy:    { label: 'Under review with support', route: null, disabled: true, variant: 'info' },
  },

  // ── Cancellation terminal states ──────────────────────────────────────────
  cancelled: {
    traveler: { label: 'View cancellation', route: { pathname: '/(traveler)/trips/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
    buddy:    { label: 'View cancellation', route: { pathname: '/(guide)/bookings/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
  },
  cancelled_no_pay: {
    traveler: { label: 'View cancellation', route: { pathname: '/(traveler)/trips/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
    buddy:    { label: 'View cancellation', route: { pathname: '/(guide)/bookings/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
  },
  cancelled_traveler_voluntary: {
    traveler: { label: 'View cancellation', route: { pathname: '/(traveler)/trips/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
    buddy:    { label: 'View cancellation', route: { pathname: '/(guide)/bookings/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
  },
  cancelled_buddy: {
    traveler: { label: 'View cancellation', route: { pathname: '/(traveler)/trips/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
    buddy:    { label: 'View cancellation', route: { pathname: '/(guide)/bookings/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
  },
  cancelled_force_majeure: {
    traveler: { label: 'View cancellation', route: { pathname: '/(traveler)/trips/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
    buddy:    { label: 'View cancellation', route: { pathname: '/(guide)/bookings/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
  },
  cancelled_pre_signing: {
    traveler: { label: 'View cancellation', route: { pathname: '/(traveler)/trips/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
    buddy:    { label: 'View cancellation', route: { pathname: '/(guide)/bookings/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
  },
  cancelled_no_deposit: {
    traveler: { label: 'View cancellation', route: { pathname: '/(traveler)/trips/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
    buddy:    { label: 'View cancellation', route: { pathname: '/(guide)/bookings/cancellation-receipt/[bookingId]' }, disabled: false, variant: 'secondary' },
  },

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
