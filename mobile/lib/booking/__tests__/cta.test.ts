// ============================================================================
// CTA MAPPING TESTS — Phase 2
// ============================================================================
// Table-driven test of getBookingCta(status, viewer). One assertion per cell
// in the plan table × 2 viewers = coverage of all Phase 2 lifecycle states.
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
    // deposits_held
    ['deposits_held', 'traveler', 'Deposits secured', true, null],
    ['deposits_held', 'buddy',    'Deposits secured', true, null],
    // awaiting_balance
    ['awaiting_balance', 'traveler', 'Deposits secured', true, null],
    ['awaiting_balance', 'buddy',    'Deposits secured', true, null],
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
      ['deposits_held',             'traveler'],
      ['deposits_held',             'buddy'],
      ['awaiting_balance',          'traveler'],
      ['awaiting_balance',          'buddy'],
    ];
    for (const [status, viewer] of infoStatuses) {
      const cta = getBookingCta(status, viewer);
      expect(cta.disabled).toBe(true);
      expect(cta.route).toBeNull();
    }
  });
});

// ─── States past awaiting_balance return empty label (Phase 2 block hides) ──

describe('getBookingCta — post-Phase-2 states return empty label', () => {
  const postPhase2: BookingState[] = [
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
  ];

  test.each(postPhase2)('%s → both viewers return empty label', (status) => {
    expect(getBookingCta(status, 'traveler').label).toBe('');
    expect(getBookingCta(status, 'buddy').label).toBe('');
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

  it('"Deposits secured" states are success variant', () => {
    expect(getBookingCta('deposits_held', 'traveler').variant).toBe('success');
    expect(getBookingCta('awaiting_balance', 'buddy').variant).toBe('success');
  });
});
