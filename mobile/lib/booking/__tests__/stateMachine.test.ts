// ============================================================================
// STATE MACHINE TESTS — Phase 1
// ============================================================================
// Target: ≥38 tests passing, zero failures.
//
// Coverage:
//   - All happy-path transitions from §3 mermaid diagram
//   - Parallel-signing guard pair (first signer / second signer)
//   - Parallel-deposit guard pair (first deposit / second deposit)
//   - Cancellation and force-majeure edges
//   - Illegal transition rejection (negative tests)
//   - canTransition utility
//   - Legacy state forward-compat shims (pending / guide_accepted / confirmed)
//   - Canonical math fixture assertions (§2 worked example)
// ============================================================================

import { transition, canTransition } from '../stateMachine';
import type { BookingState, BookingEvent, GuardContext } from '../stateMachine';
import { formatPaise, paiseToRupees, rupeesToPaise } from '../money';
import {
  CANONICAL_AGREEMENT_INPUTS,
  CANONICAL_DERIVED,
} from '../__fixtures__/canonical';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test helpers
// ─────────────────────────────────────────────────────────────────────────────

const CTX_DEFAULT: GuardContext = {
  bothSignaturesPresent: false,
  bothDepositsHeld: false,
};

const CTX_BOTH_SIGNED: GuardContext = {
  bothSignaturesPresent: true,
  bothDepositsHeld: false,
};

const CTX_BOTH_DEPOSITS: GuardContext = {
  bothSignaturesPresent: true,
  bothDepositsHeld: true,
};

// Helper kept for potential future use in assertion-style tests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ok = (state: BookingState, event: BookingEvent, ctx: GuardContext = CTX_DEFAULT) =>
  expect(transition(state, event, ctx)).toEqual({ ok: true, next: expect.any(String) });

const next = (from: BookingState, event: BookingEvent, ctx: GuardContext = CTX_DEFAULT) => {
  const result = transition(from, event, ctx);
  if (!result.ok) throw new Error(`Expected ok transition from ${from} on ${event.kind}`);
  return result.next;
};

const illegal = (state: BookingState, event: BookingEvent, ctx: GuardContext = CTX_DEFAULT) =>
  expect(transition(state, event, ctx)).toMatchObject({
    ok: false,
    error: 'illegal_transition',
    from: state,
  });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Happy-path main line
// ─────────────────────────────────────────────────────────────────────────────

describe('Happy-path main line', () => {
  test('chat_open + guide_starts_drafting → agreement_drafting', () => {
    expect(next('chat_open', { kind: 'guide_starts_drafting' })).toBe('agreement_drafting');
  });

  test('agreement_drafting + guide_sends_agreement → agreement_sent', () => {
    expect(next('agreement_drafting', { kind: 'guide_sends_agreement' })).toBe('agreement_sent');
  });

  test('agreement_sent + traveler_signs → agreement_signed_traveler', () => {
    expect(next('agreement_sent', { kind: 'traveler_signs' })).toBe('agreement_signed_traveler');
  });

  test('agreement_signed_traveler + buddy_signs (both present) → awaiting_deposits', () => {
    expect(
      next('agreement_signed_traveler', { kind: 'buddy_signs' }, CTX_BOTH_SIGNED),
    ).toBe('awaiting_deposits');
  });

  test('awaiting_deposits + deposit_captured (both held) → deposits_held', () => {
    expect(
      next('awaiting_deposits', { kind: 'deposit_captured', side: 'buddy' }, CTX_BOTH_DEPOSITS),
    ).toBe('deposits_held');
  });

  test('awaiting_balance + balance_captured → balance_paid', () => {
    expect(next('awaiting_balance', { kind: 'balance_captured' })).toBe('balance_paid');
  });

  test('balance_paid + t_minus_12_reached → trip_ready', () => {
    expect(next('balance_paid', { kind: 't_minus_12_reached' })).toBe('trip_ready');
  });

  test('trip_ready + qr_scanned → in_progress', () => {
    expect(next('trip_ready', { kind: 'qr_scanned' })).toBe('in_progress');
  });

  test('in_progress + buddy_ends_trip → awaiting_proofs', () => {
    expect(next('in_progress', { kind: 'buddy_ends_trip' })).toBe('awaiting_proofs');
  });

  test('awaiting_proofs + proofs_uploaded → reconciling', () => {
    expect(next('awaiting_proofs', { kind: 'proofs_uploaded' })).toBe('reconciling');
  });

  test('reconciling + reconciliation_complete → completed', () => {
    expect(next('reconciling', { kind: 'reconciliation_complete' })).toBe('completed');
  });

  test('completed + rating_submitted → rated', () => {
    expect(next('completed', { kind: 'rating_submitted' })).toBe('rated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Parallel signing — traveler signs first, then buddy
// ─────────────────────────────────────────────────────────────────────────────

describe('Parallel signing — traveler first', () => {
  test('agreement_sent + traveler_signs → agreement_signed_traveler (first signer)', () => {
    expect(next('agreement_sent', { kind: 'traveler_signs' }, CTX_DEFAULT)).toBe(
      'agreement_signed_traveler',
    );
  });

  test('agreement_signed_traveler + buddy_signs (both present) → awaiting_deposits (second signer)', () => {
    expect(
      next('agreement_signed_traveler', { kind: 'buddy_signs' }, CTX_BOTH_SIGNED),
    ).toBe('awaiting_deposits');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Parallel signing — buddy signs first, then traveler
// ─────────────────────────────────────────────────────────────────────────────

describe('Parallel signing — buddy first', () => {
  test('agreement_sent + buddy_signs → agreement_signed_buddy (first signer)', () => {
    expect(next('agreement_sent', { kind: 'buddy_signs' }, CTX_DEFAULT)).toBe(
      'agreement_signed_buddy',
    );
  });

  test('agreement_signed_buddy + traveler_signs (both present) → awaiting_deposits (second signer)', () => {
    expect(
      next('agreement_signed_buddy', { kind: 'traveler_signs' }, CTX_BOTH_SIGNED),
    ).toBe('awaiting_deposits');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Parallel deposits
// ─────────────────────────────────────────────────────────────────────────────

describe('Parallel deposits', () => {
  test('awaiting_deposits + deposit_captured (first, not both held) → awaiting_deposits (no-op)', () => {
    expect(
      next('awaiting_deposits', { kind: 'deposit_captured', side: 'traveler' }, CTX_DEFAULT),
    ).toBe('awaiting_deposits');
  });

  test('awaiting_deposits + deposit_captured (second, both held) → deposits_held', () => {
    expect(
      next('awaiting_deposits', { kind: 'deposit_captured', side: 'buddy' }, CTX_BOTH_DEPOSITS),
    ).toBe('deposits_held');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Late-fee path
// ─────────────────────────────────────────────────────────────────────────────

describe('Late-fee path', () => {
  test('awaiting_balance + t_minus_72_reached → late_fee_due', () => {
    expect(next('awaiting_balance', { kind: 't_minus_72_reached' })).toBe('late_fee_due');
  });

  test('late_fee_due + balance_captured → balance_paid (paid late)', () => {
    expect(next('late_fee_due', { kind: 'balance_captured' })).toBe('balance_paid');
  });

  test('late_fee_due + t_minus_12_reached → cancelled_no_pay', () => {
    expect(next('late_fee_due', { kind: 't_minus_12_reached' })).toBe('cancelled_no_pay');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Cancellation edges
// ─────────────────────────────────────────────────────────────────────────────

describe('Cancellation edges', () => {
  test('agreement_drafting + cancel → cancelled_pre_signing', () => {
    expect(
      next('agreement_drafting', { kind: 'cancel', actor: 'traveler', reason: 'changed_mind' }),
    ).toBe('cancelled_pre_signing');
  });

  test('agreement_sent + cancel → cancelled_pre_signing', () => {
    expect(
      next('agreement_sent', { kind: 'cancel', actor: 'buddy', reason: 'schedule_conflict' }),
    ).toBe('cancelled_pre_signing');
  });

  test('awaiting_deposits + cancel → cancelled_pre_signing', () => {
    expect(
      next('awaiting_deposits', { kind: 'cancel', actor: 'traveler', reason: 'no_show' }),
    ).toBe('cancelled_pre_signing');
  });

  test('awaiting_deposits + deposit_window_expired → cancelled_no_deposit', () => {
    expect(next('awaiting_deposits', { kind: 'deposit_window_expired' })).toBe(
      'cancelled_no_deposit',
    );
  });

  test('awaiting_balance + cancel (traveler) → cancelled_traveler_voluntary', () => {
    expect(
      next('awaiting_balance', {
        kind: 'cancel',
        actor: 'traveler',
        reason: 'flight_rescheduled',
      }),
    ).toBe('cancelled_traveler_voluntary');
  });

  test('balance_paid + cancel (traveler) → cancelled_traveler_voluntary', () => {
    expect(
      next('balance_paid', { kind: 'cancel', actor: 'traveler', reason: 'emergency' }),
    ).toBe('cancelled_traveler_voluntary');
  });

  test('balance_paid + cancel (buddy) → cancelled_buddy', () => {
    expect(
      next('balance_paid', { kind: 'cancel', actor: 'buddy', reason: 'emergency' }),
    ).toBe('cancelled_buddy');
  });

  test('awaiting_balance + cancel (buddy) → cancelled_buddy', () => {
    expect(
      next('awaiting_balance', { kind: 'cancel', actor: 'buddy', reason: 'emergency' }),
    ).toBe('cancelled_buddy');
  });

  test('late_fee_due + cancel (traveler) → cancelled_traveler_voluntary', () => {
    expect(
      next('late_fee_due', { kind: 'cancel', actor: 'traveler', reason: 'gave_up' }),
    ).toBe('cancelled_traveler_voluntary');
  });

  test('late_fee_due + cancel (buddy) → cancelled_buddy', () => {
    expect(
      next('late_fee_due', { kind: 'cancel', actor: 'buddy', reason: 'unavailable' }),
    ).toBe('cancelled_buddy');
  });

  test('trip_ready + cancel (buddy) → cancelled_buddy', () => {
    expect(
      next('trip_ready', { kind: 'cancel', actor: 'buddy', reason: 'no_show' }),
    ).toBe('cancelled_buddy');
  });

  // Platform/system cancellations must never be recorded as traveler-voluntary:
  // the voluntary tiers penalise the traveler (voucher / forfeiture) for a
  // decision they didn't make. They get force-majeure treatment instead.
  const platformCancellableStates = [
    'awaiting_balance',
    'late_fee_due',
    'balance_paid',
    'trip_ready',
  ] as const;

  test.each(platformCancellableStates)(
    '%s + cancel (platform) → cancelled_force_majeure',
    (state) => {
      expect(
        next(state, { kind: 'cancel', actor: 'platform', reason: 'ops_decision' }),
      ).toBe('cancelled_force_majeure');
    },
  );

  test.each(platformCancellableStates)(
    '%s + cancel (system) → cancelled_force_majeure',
    (state) => {
      expect(
        next(state, { kind: 'cancel', actor: 'system', reason: 'automated_cleanup' }),
      ).toBe('cancelled_force_majeure');
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Force-majeure and dispute edges
// ─────────────────────────────────────────────────────────────────────────────

describe('Force-majeure and dispute edges', () => {
  test('balance_paid + force_majeure_verified → cancelled_force_majeure', () => {
    expect(next('balance_paid', { kind: 'force_majeure_verified' })).toBe(
      'cancelled_force_majeure',
    );
  });

  test('trip_ready + force_majeure_verified → cancelled_force_majeure', () => {
    expect(next('trip_ready', { kind: 'force_majeure_verified' })).toBe(
      'cancelled_force_majeure',
    );
  });

  test('awaiting_balance + force_majeure_verified → cancelled_force_majeure', () => {
    expect(next('awaiting_balance', { kind: 'force_majeure_verified' })).toBe(
      'cancelled_force_majeure',
    );
  });

  test('late_fee_due + force_majeure_verified → cancelled_force_majeure', () => {
    expect(next('late_fee_due', { kind: 'force_majeure_verified' })).toBe(
      'cancelled_force_majeure',
    );
  });

  test('in_progress + dispute_raised → disputed', () => {
    expect(next('in_progress', { kind: 'dispute_raised' })).toBe('disputed');
  });

  test('awaiting_proofs + dispute_raised → disputed', () => {
    expect(next('awaiting_proofs', { kind: 'dispute_raised' })).toBe('disputed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Illegal transition negative tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Illegal transitions', () => {
  test('chat_open + balance_captured → illegal', () => {
    illegal('chat_open', { kind: 'balance_captured' });
  });

  test('agreement_sent + qr_scanned → illegal', () => {
    illegal('agreement_sent', { kind: 'qr_scanned' });
  });

  test('rated + guide_starts_drafting → illegal (terminal)', () => {
    illegal('rated', { kind: 'guide_starts_drafting' });
  });

  test('cancelled_pre_signing + balance_captured → illegal (terminal)', () => {
    illegal('cancelled_pre_signing', { kind: 'balance_captured' });
  });

  test('agreement_signed_traveler + buddy_signs (guard false) → illegal', () => {
    // bothSignaturesPresent=false means we haven't both signed yet —
    // something is wrong with the caller, treat as illegal
    illegal(
      'agreement_signed_traveler',
      { kind: 'buddy_signs' },
      CTX_DEFAULT, // bothSignaturesPresent = false
    );
  });

  test('disputed + reconciliation_complete → illegal (terminal)', () => {
    illegal('disputed', { kind: 'reconciliation_complete' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. canTransition utility
// ─────────────────────────────────────────────────────────────────────────────

describe('canTransition', () => {
  test('chat_open can receive guide_starts_drafting', () => {
    expect(canTransition('chat_open', 'guide_starts_drafting')).toBe(true);
  });

  test('chat_open cannot receive qr_scanned', () => {
    expect(canTransition('chat_open', 'qr_scanned')).toBe(false);
  });

  test('rated cannot receive anything', () => {
    expect(canTransition('rated', 'rating_submitted')).toBe(false);
    expect(canTransition('rated', 'guide_starts_drafting')).toBe(false);
  });

  test('awaiting_deposits can receive deposit_captured', () => {
    expect(canTransition('awaiting_deposits', 'deposit_captured')).toBe(true);
  });

  test('in_progress can receive dispute_raised', () => {
    expect(canTransition('in_progress', 'dispute_raised')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Canonical math assertions — §2 worked example
// ─────────────────────────────────────────────────────────────────────────────

describe('Canonical fixture — §2 worked example', () => {
  const { buddyFeePaise, itineraryFundPaise, bufferPaise, gstRate, depositPaise } =
    CANONICAL_AGREEMENT_INPUTS;
  const {
    buddyFeeTravelerViewPaise,
    travelerSubtotalPaise,
    travelerGstPaise,
    travelerTotalPaise,
    tripPotPaise,
    unusedBufferPaise,
    spentPaise,
    buddyFeeNetPaise,
    tdsPaise,
    buddyDepositRefundPaise,
    buddyNetPayoutPaise,
    travelerRefundAtEndPaise,
  } = CANONICAL_DERIVED;

  test('traveler total is ₹6,642.50 (664,250 paise)', () => {
    expect(travelerTotalPaise).toBe(664_250);
  });

  test('buddy net payout is ₹2,032.50 (203,250 paise)', () => {
    expect(buddyNetPayoutPaise).toBe(203_250);
  });

  test('formatPaise renders traveler total correctly', () => {
    expect(formatPaise(travelerTotalPaise)).toBe('₹6,642.50');
  });

  test('formatPaise renders buddy net payout correctly', () => {
    expect(formatPaise(buddyNetPayoutPaise)).toBe('₹2,032.50');
  });

  test('buddy fee traveler view = gross × 1.125', () => {
    expect(buddyFeeTravelerViewPaise).toBe(Math.round(buddyFeePaise * 1.125));
  });

  test('traveler subtotal = traveler-view buddy fee + itinerary + buffer', () => {
    expect(travelerSubtotalPaise).toBe(
      buddyFeeTravelerViewPaise + itineraryFundPaise + bufferPaise,
    );
  });

  test('traveler GST = subtotal × gstRate', () => {
    expect(travelerGstPaise).toBe(Math.round(travelerSubtotalPaise * gstRate));
  });

  test('traveler total = subtotal + GST + deposit', () => {
    expect(travelerTotalPaise).toBe(travelerSubtotalPaise + travelerGstPaise + depositPaise);
  });

  test('trip pot = itinerary fund + buffer', () => {
    expect(tripPotPaise).toBe(itineraryFundPaise + bufferPaise);
  });

  test('unused buffer = trip pot − amount spent', () => {
    expect(unusedBufferPaise).toBe(tripPotPaise - spentPaise);
  });

  test('buddy fee net = gross × 0.875', () => {
    expect(buddyFeeNetPaise).toBe(Math.round(buddyFeePaise * 0.875));
  });

  test('TDS = buddy fee net × 0.01', () => {
    expect(tdsPaise).toBe(Math.round(buddyFeeNetPaise * 0.01));
  });

  test('buddy net payout formula: fee_net − TDS + deposit − unused_buffer', () => {
    expect(buddyNetPayoutPaise).toBe(
      buddyFeeNetPaise - tdsPaise + buddyDepositRefundPaise - unusedBufferPaise,
    );
  });

  test('traveler end refund = unused buffer + deposit', () => {
    expect(travelerRefundAtEndPaise).toBe(unusedBufferPaise + depositPaise);
  });

  test('paiseToRupees round-trips correctly', () => {
    expect(paiseToRupees(664_250)).toBeCloseTo(6642.5, 2);
    expect(paiseToRupees(203_250)).toBeCloseTo(2032.5, 2);
  });

  test('rupeesToPaise round-trips correctly', () => {
    expect(rupeesToPaise(6642.5)).toBe(664_250);
    expect(rupeesToPaise(2032.5)).toBe(203_250);
  });

  test('platform fee: gross = traveler-side + buddy-side', () => {
    const { platformFeeGrossPaise, platformFeeTravelerSidePaise, platformFeeBuddySidePaise } =
      CANONICAL_DERIVED;
    expect(platformFeeGrossPaise).toBe(platformFeeTravelerSidePaise + platformFeeBuddySidePaise);
  });

  test('platform fee traveler-side = buddyFeeTravelerViewPaise − buddyFeePaise', () => {
    const { platformFeeTravelerSidePaise, buddyFeeTravelerViewPaise } = CANONICAL_DERIVED;
    expect(platformFeeTravelerSidePaise).toBe(
      buddyFeeTravelerViewPaise - buddyFeePaise,
    );
  });

  test('platform fee buddy-side = buddyFeePaise − buddyFeeNetPaise', () => {
    const { platformFeeBuddySidePaise, buddyFeeNetPaise } = CANONICAL_DERIVED;
    expect(platformFeeBuddySidePaise).toBe(buddyFeePaise - buddyFeeNetPaise);
  });

  test('full reconciliation balances: escrow ≡ all outflows', () => {
    // The escrow releases money in two tranches:
    //   (A) At QR scan:  tripPot (360k) → buddy UPI for day-of vendor payments
    //   (B) At trip end: buddyFinalPayout + travelerRefund + platformFee + GST + TDS
    //
    // The unused buffer (20k) is NOT a separate escrow return — it is netted out
    // of the buddy's final payment formula, so the escrow only ever releases
    // the full trip pot (360k) in tranche A, not the actual spend (340k).
    //
    // §4 identity: 714,250 = 360,000 (trip pot) + 203,250 (buddy final)
    //                       + 70,000 (traveler refund) + 50,000 (platform)
    //                       + 29,250 (GST) + 1,750 (TDS) = 714,250 ✓
    const {
      tripPotPaise,            // 360_000 — released at QR scan to buddy UPI
      buddyNetPayoutPaise: buddyFinalPayout,
      travelerRefundAtEndPaise: travelerRefund,
      platformFeeGrossPaise,   // 50_000 — total 25% gross (both sides combined)
    } = CANONICAL_DERIVED;

    const escrowPaise = travelerTotalPaise + depositPaise; // 664_250 + 50_000 = 714_250

    const totalOut = tripPotPaise + buddyFinalPayout + travelerRefund
                   + platformFeeGrossPaise + travelerGstPaise + tdsPaise;

    // All individual components must be positive
    expect(tripPotPaise).toBeGreaterThan(0);
    expect(buddyFinalPayout).toBeGreaterThan(0);
    expect(travelerRefund).toBeGreaterThan(0);
    expect(platformFeeGrossPaise).toBe(50_000);

    // Exact check: the six outflow streams account for every paise of escrow
    expect(totalOut).toBe(escrowPaise);
    expect(escrowPaise).toBe(714_250);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Legacy state forward-compat shims
// ─────────────────────────────────────────────────────────────────────────────

describe('Legacy state shims', () => {
  test('pending behaves like agreement_sent: traveler_signs → agreement_signed_traveler', () => {
    expect(next('pending', { kind: 'traveler_signs' })).toBe('agreement_signed_traveler');
  });

  test('pending behaves like agreement_sent: buddy_signs → agreement_signed_buddy', () => {
    expect(next('pending', { kind: 'buddy_signs' })).toBe('agreement_signed_buddy');
  });

  test('pending behaves like agreement_sent: cancel → cancelled_pre_signing', () => {
    expect(
      next('pending', { kind: 'cancel', actor: 'traveler', reason: 'changed_mind' }),
    ).toBe('cancelled_pre_signing');
  });

  test('guide_accepted behaves like awaiting_deposits: deposit_captured (both held) → deposits_held', () => {
    expect(
      next('guide_accepted', { kind: 'deposit_captured', side: 'traveler' }, CTX_BOTH_DEPOSITS),
    ).toBe('deposits_held');
  });

  test('guide_accepted behaves like awaiting_deposits: deposit_window_expired → cancelled_no_deposit', () => {
    expect(next('guide_accepted', { kind: 'deposit_window_expired' })).toBe(
      'cancelled_no_deposit',
    );
  });

  test('confirmed behaves like balance_paid: t_minus_12_reached → trip_ready', () => {
    expect(next('confirmed', { kind: 't_minus_12_reached' })).toBe('trip_ready');
  });

  test('confirmed behaves like balance_paid: force_majeure_verified → cancelled_force_majeure', () => {
    expect(next('confirmed', { kind: 'force_majeure_verified' })).toBe(
      'cancelled_force_majeure',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// State-classification helpers (added 2026-05-14 review fix #19-21)
// ─────────────────────────────────────────────────────────────────────────────

import {
  isUpcomingBookingState,
  isActiveBookingState,
  PAST_BOOKING_STATES,
  TERMINAL_BOOKING_STATES,
} from '../stateMachine';

describe('isUpcomingBookingState / isActiveBookingState', () => {
  test.each([
    ['chat_open',                    true,  true ],
    ['agreement_drafting',           true,  true ],
    ['agreement_sent',               true,  true ],
    ['agreement_signed_traveler',    true,  true ],
    ['agreement_signed_buddy',       true,  true ],
    ['awaiting_deposits',            true,  true ],
    ['deposits_held',                true,  true ],
    ['awaiting_balance',             true,  true ],
    ['balance_paid',                 true,  true ],
    ['late_fee_due',                 true,  true ],
    ['trip_ready',                   true,  true ],
    ['in_progress',                  true,  true ],
    ['awaiting_proofs',              true,  true ],
    ['reconciling',                  true,  true ],
    // completed is "past" from the user's perspective but still has one
    // outgoing transition (rating_submitted → rated), so it remains "active".
    ['completed',                    false, true ],
    ['rated',                        false, false],
    ['disputed',                     false, false],
    ['cancelled',                    false, false],
    ['cancelled_no_pay',             false, false],
    ['cancelled_traveler_voluntary', false, false],
    ['cancelled_buddy',              false, false],
    ['cancelled_force_majeure',      false, false],
    ['cancelled_pre_signing',        false, false],
    ['cancelled_no_deposit',         false, false],
  ] as const)('classifies %s → upcoming=%s active=%s', (state, upcoming, active) => {
    expect(isUpcomingBookingState(state as never)).toBe(upcoming);
    expect(isActiveBookingState(state as never)).toBe(active);
  });

  test('PAST_BOOKING_STATES is TERMINAL ∪ {completed}', () => {
    expect(PAST_BOOKING_STATES.has('completed')).toBe(true);
    for (const t of TERMINAL_BOOKING_STATES) {
      expect(PAST_BOOKING_STATES.has(t)).toBe(true);
    }
    expect(PAST_BOOKING_STATES.size).toBe(TERMINAL_BOOKING_STATES.size + 1);
  });
});
