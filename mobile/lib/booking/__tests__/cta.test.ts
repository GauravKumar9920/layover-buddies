// ============================================================================
// CTA MAPPING TESTS — Phase 2 / 3 / 4
// ============================================================================
// Table-driven test of getBookingCta(status, viewer). One assertion per cell
// in the plan table × 2 viewers = coverage of the full booking lifecycle
// (agreement → deposits → balance → trip → reconciliation → cancellation).
// ============================================================================

import { getBookingCta } from '../cta';
import type { BookingState } from '../stateMachine';
import type { Viewer } from '../cta';

// ─── Phase 2 active states — both viewers ───────────────────────────────────

describe('getBookingCta — Phase 2 active states', () => {
  // [ status, viewer, expectLabel (substring), expectDisabled, expectRoute (null or partial path) ]
  type Row = [BookingState, Viewer, string, boolean, string | null];

  const table: Row[] = [
    // chat_open
    ['chat_open', 'traveler', 'Waiting for guide',      true,  null],
    ['chat_open', 'buddy',    'Draft agreement',         false, '/(guide)/bookings/agreement-draft/[bookingId]'],
    // agreement_drafting
    ['agreement_drafting', 'traveler', 'Guide is drafting', true,  null],
    ['agreement_drafting', 'buddy',    'Continue drafting', false, '/(guide)/bookings/agreement-draft/[bookingId]'],
    // agreement_sent
    ['agreement_sent', 'traveler', 'Review and sign', false, '/(shared)/agreements/[bookingId]'],
    ['agreement_sent', 'buddy',    'Review and sign', false, '/(shared)/agreements/[bookingId]'],
    // agreement_signed_traveler
    ['agreement_signed_traveler', 'traveler', 'Waiting for guide to sign', true,  null],
    ['agreement_signed_traveler', 'buddy',    'Review and sign',           false, '/(shared)/agreements/[bookingId]'],
    // agreement_signed_buddy
    ['agreement_signed_buddy', 'traveler', 'Review and sign',              false, '/(shared)/agreements/[bookingId]'],
    ['agreement_signed_buddy', 'buddy',    'Waiting for traveler to sign', true,  null],
    // awaiting_deposits
    ['awaiting_deposits', 'traveler', 'Pay ₹500 deposit', false, '/(shared)/agreements/[bookingId]'],
    ['awaiting_deposits', 'buddy',    'Pay ₹500 deposit', false, '/(shared)/agreements/[bookingId]'],
    // deposits_held — BOTH deposits are in escrow (the state machine only
    // enters this state on the second deposit_captured with bothDepositsHeld).
    // Nobody owes anything; both viewers see a confirmation that links back
    // to the agreement. (APP_REVIEW §1.1 — previously showed the buddy a
    // "Pay ₹500 deposit" button for a payment already made.)
    ['deposits_held', 'traveler', 'Deposits secured', false, '/(shared)/agreements/[bookingId]'],
    ['deposits_held', 'buddy',    'Deposits secured', false, '/(shared)/agreements/[bookingId]'],
    // awaiting_balance — Phase 3: traveler pays the balance (actionable);
    // buddy waits (info-only).
    ['awaiting_balance', 'traveler', 'Pay trip balance',          false, '/(traveler)/trips/balance/[bookingId]'],
    ['awaiting_balance', 'buddy',    'Awaiting traveler balance', true,  null],
  ];

  test.each(table)(
    '%s × %s: label contains "%s", disabled=%s',
    (status, viewer, labelSubstring, expectDisabled, expectRoutePath) => {
      const cta = getBookingCta(status, viewer);
      expect(cta.label).toContain(labelSubstring);
      expect(cta.disabled).toBe(expectDisabled);
      if (expectRoutePath === null) {
        expect(cta.route).toBeNull();
      } else {
        expect(cta.route?.pathname).toBe(expectRoutePath);
      }
    },
  );
});

// ─── Actionable CTAs have routes; informational ones don't ──────────────────

describe('getBookingCta — route/disabled consistency', () => {
  it('non-disabled CTA always has a route', () => {
    const actionableStatuses: BookingState[] = [
      'chat_open',
      'agreement_drafting',
      'agreement_sent',
      'agreement_signed_traveler',
      'agreement_signed_buddy',
      'awaiting_deposits',
      // deposits_held routes to the agreement screen for review (not a
      // payment — both deposits are already held).
      'deposits_held',
    ];
    for (const status of actionableStatuses) {
      for (const viewer of ['traveler', 'buddy'] as Viewer[]) {
        const cta = getBookingCta(status, viewer);
        if (!cta.disabled && cta.label) {
          expect(cta.route).not.toBeNull();
        }
      }
    }
  });

  it('disabled CTAs with labels have no route (info-only)', () => {
    const infoStatuses: [BookingState, Viewer][] = [
      ['chat_open',                 'traveler'],
      ['agreement_drafting',        'traveler'],
      ['agreement_signed_traveler', 'traveler'],
      ['agreement_signed_buddy',    'buddy'],
      ['awaiting_balance',          'buddy'],
    ];
    for (const [status, viewer] of infoStatuses) {
      const cta = getBookingCta(status, viewer);
      expect(cta.disabled).toBe(true);
      expect(cta.route).toBeNull();
    }
  });
});

// ─── Phase 3-4 lifecycle states — balance, trip, reconciliation ─────────────
// Phase 3-4 gave every state past awaiting_balance a real CTA (balance
// payment, QR, in-trip, receipts). Each cell mirrors the mapping in cta.ts.

describe('getBookingCta — Phase 3-4 lifecycle states', () => {
  type Row = [BookingState, Viewer, string, boolean, string | null];

  const table: Row[] = [
    // late_fee_due — traveler owes balance + late fee; buddy waits.
    ['late_fee_due', 'traveler', 'late fee',                 false, '/(traveler)/trips/balance/[bookingId]'],
    ['late_fee_due', 'buddy',    'Awaiting traveler balance', true,  null],
    // balance_paid — both see "Trip confirmed" (info-only anchor).
    ['balance_paid', 'traveler', 'Trip confirmed', true, null],
    ['balance_paid', 'buddy',    'Trip confirmed', true, null],
    // trip_ready — traveler shows QR, buddy scans it.
    ['trip_ready', 'traveler', 'Show your QR code', false, '/(traveler)/trips/qr/[bookingId]'],
    ['trip_ready', 'buddy',    'Scan traveler QR',  false, '/(guide)/bookings/qr-scan/[bookingId]'],
    // in_progress — both route into the live-trip experience.
    ['in_progress', 'traveler', 'Trip in progress', false, '/(traveler)/trips/live/[id]'],
    ['in_progress', 'buddy',    'Trip in progress', false, '/(guide)/bookings/in-trip/[bookingId]'],
    // awaiting_proofs — buddy uploads expense proofs; traveler waits.
    ['awaiting_proofs', 'traveler', 'wrapping up',          true,  null],
    ['awaiting_proofs', 'buddy',    'Upload expense proofs', false, '/(guide)/bookings/upload-proofs/[bookingId]'],
    // reconciling — both info-only while the day settles.
    ['reconciling', 'traveler', 'Settling up', true, null],
    ['reconciling', 'buddy',    'Settling up', true, null],
    // completed — receipts for each side.
    ['completed', 'traveler', 'See day receipt',    false, '/(traveler)/trips/receipt/[bookingId]'],
    ['completed', 'buddy',    'See payout receipt', false, '/(guide)/bookings/receipt/[bookingId]'],
    // rated — terminal, info-only.
    ['rated', 'traveler', 'Thanks for the rating', true, null],
    ['rated', 'buddy',    'Trip complete',          true, null],
    // disputed — info-only for both.
    ['disputed', 'traveler', 'Under review', true, null],
    ['disputed', 'buddy',    'Under review', true, null],
  ];

  test.each(table)(
    '%s × %s: label contains "%s", disabled=%s',
    (status, viewer, labelSubstring, expectDisabled, expectRoutePath) => {
      const cta = getBookingCta(status, viewer);
      expect(cta.label).toContain(labelSubstring);
      expect(cta.disabled).toBe(expectDisabled);
      if (expectRoutePath === null) {
        expect(cta.route).toBeNull();
      } else {
        expect(cta.route?.pathname).toBe(expectRoutePath);
      }
    },
  );
});

// ─── Cancellation terminal states — both viewers see "View cancellation" ────
// Every cancelled_* state maps to a cancellation-receipt CTA, routed per viewer.

describe('getBookingCta — cancellation states', () => {
  const cancelledStates: BookingState[] = [
    'cancelled',
    'cancelled_no_pay',
    'cancelled_traveler_voluntary',
    'cancelled_buddy',
    'cancelled_force_majeure',
    'cancelled_pre_signing',
    'cancelled_no_deposit',
  ];

  test.each(cancelledStates)('%s → both viewers see a "View cancellation" receipt CTA', (status) => {
    const traveler = getBookingCta(status, 'traveler');
    expect(traveler.label).toBe('View cancellation');
    expect(traveler.disabled).toBe(false);
    expect(traveler.route?.pathname).toBe('/(traveler)/trips/cancellation-receipt/[bookingId]');

    const buddy = getBookingCta(status, 'buddy');
    expect(buddy.label).toBe('View cancellation');
    expect(buddy.disabled).toBe(false);
    expect(buddy.route?.pathname).toBe('/(guide)/bookings/cancellation-receipt/[bookingId]');
  });
});

// ─── Legacy states return empty label (no Phase 2 CTA for pre-lifecycle) ────

describe('getBookingCta — legacy states return empty label', () => {
  const legacyStates: BookingState[] = ['pending', 'guide_accepted', 'confirmed'];

  test.each(legacyStates)('%s → both viewers return empty label', (status) => {
    expect(getBookingCta(status, 'traveler').label).toBe('');
    expect(getBookingCta(status, 'buddy').label).toBe('');
  });
});

// ─── Variant checks for primary CTA states ──────────────────────────────────

describe('getBookingCta — variant', () => {
  it('buddy "Draft agreement" is primary variant', () => {
    expect(getBookingCta('chat_open', 'buddy').variant).toBe('primary');
  });

  it('"Review and sign" is primary variant for both viewers', () => {
    expect(getBookingCta('agreement_sent', 'traveler').variant).toBe('primary');
    expect(getBookingCta('agreement_sent', 'buddy').variant).toBe('primary');
  });

  it('"Pay ₹500 deposit" is primary variant', () => {
    expect(getBookingCta('awaiting_deposits', 'traveler').variant).toBe('primary');
  });

  it('informational waiting labels are info variant', () => {
    expect(getBookingCta('chat_open', 'traveler').variant).toBe('info');
    expect(getBookingCta('agreement_signed_traveler', 'traveler').variant).toBe('info');
  });

  // APP_REVIEW §1.1 regression: deposits_held means BOTH deposits are held
  // (stateMachine.ts is authoritative — second deposit_captured with
  // bothDepositsHeld is the only way in). The CTA must never ask either side
  // to pay a deposit again from this state.
  it('deposits_held never shows a pay CTA (both deposits already held)', () => {
    for (const viewer of ['traveler', 'buddy'] as const) {
      const cta = getBookingCta('deposits_held', viewer);
      expect(cta.label).not.toMatch(/pay/i);
      expect(cta.variant).toBe('success');
      expect(cta.disabled).toBe(false);
      expect(cta.route?.pathname).toBe('/(shared)/agreements/[bookingId]');
    }
  });

  it('late_fee_due label does not hardcode the fee amount (configurable in platform_settings)', () => {
    expect(getBookingCta('late_fee_due', 'traveler').label).not.toMatch(/₹\s?1,?000/);
  });
});
