// ============================================================================
// AGREEMENT SNAPSHOT TESTS — Phase 2
// ============================================================================
// Tests `computeAgreementSnapshot` against the canonical fixture and edge
// cases. The canonical fixture asserts travelerTotalPaise === 664_250
// (₹6,642.50) and is shared with stateMachine.test.ts.
// ============================================================================

import {
  computeAgreementSnapshot,
  InvalidBufferError,
  InvalidAmountError,
} from '../agreementSnapshot';
import { formatPaise } from '../money';
import {
  CANONICAL_AGREEMENT_INPUTS,
  CANONICAL_DERIVED,
} from '../__fixtures__/canonical';

// ─── Canonical fixture assertions ──────────────────────────────────────────

describe('computeAgreementSnapshot — canonical inputs', () => {
  const snap = computeAgreementSnapshot({
    buddyFeePaise:      CANONICAL_AGREEMENT_INPUTS.buddyFeePaise,
    itineraryFundPaise: CANONICAL_AGREEMENT_INPUTS.itineraryFundPaise,
    bufferPaise:        CANONICAL_AGREEMENT_INPUTS.bufferPaise,
    gstRate:            CANONICAL_AGREEMENT_INPUTS.gstRate,
  });

  it('travelerSubtotalPaise matches canonical (₹5,850)', () => {
    expect(snap.travelerSubtotalPaise).toBe(CANONICAL_DERIVED.travelerSubtotalPaise); // 585_000
  });

  it('travelerGstPaise matches canonical (₹292.50)', () => {
    expect(snap.travelerGstPaise).toBe(CANONICAL_DERIVED.travelerGstPaise); // 29_250
  });

  it('travelerTotalPaise matches canonical (₹6,642.50)', () => {
    expect(snap.travelerTotalPaise).toBe(CANONICAL_DERIVED.travelerTotalPaise); // 664_250
  });

  it('buddyFeeTravelerViewPaise matches canonical (₹2,250)', () => {
    expect(snap.buddyFeeTravelerViewPaise).toBe(CANONICAL_DERIVED.buddyFeeTravelerViewPaise); // 225_000
  });

  it('formatPaise(travelerTotalPaise) renders as ₹6,642.50', () => {
    expect(formatPaise(snap.travelerTotalPaise)).toBe('₹6,642.50');
  });

  it('total = subtotal + gst + 50000 (deposit invariant)', () => {
    expect(snap.travelerTotalPaise).toBe(snap.travelerSubtotalPaise + snap.travelerGstPaise + 50_000);
  });
});

// ─── InvalidBufferError ─────────────────────────────────────────────────────

describe('computeAgreementSnapshot — InvalidBufferError', () => {
  it('throws when buffer is too high', () => {
    expect(() =>
      computeAgreementSnapshot({
        buddyFeePaise:      200_000,
        itineraryFundPaise: 300_000,
        bufferPaise:        61_000,   // expected 60_000
        gstRate:            0.05,
      }),
    ).toThrow(InvalidBufferError);
  });

  it('throws when buffer is too low', () => {
    expect(() =>
      computeAgreementSnapshot({
        buddyFeePaise:      200_000,
        itineraryFundPaise: 300_000,
        bufferPaise:        59_000,   // expected 60_000
        gstRate:            0.05,
      }),
    ).toThrow(InvalidBufferError);
  });

  it('throws when buffer is 0 but itinerary is non-zero', () => {
    expect(() =>
      computeAgreementSnapshot({
        buddyFeePaise:      100_000,
        itineraryFundPaise: 100_000,
        bufferPaise:        0,        // expected 20_000
        gstRate:            0.05,
      }),
    ).toThrow(InvalidBufferError);
  });

  it('error message includes expected and actual paise', () => {
    expect(() =>
      computeAgreementSnapshot({
        buddyFeePaise:      200_000,
        itineraryFundPaise: 300_000,
        bufferPaise:        999,
        gstRate:            0.05,
      }),
    ).toThrow(/expected 60000 paise/i);
  });
});

// ─── Edge case: itinerary fund of 1 paise ──────────────────────────────────

describe('computeAgreementSnapshot — minimal itinerary fund (1 paise)', () => {
  it('allows buffer = 0 when floor(1 × 0.20) = 0', () => {
    // floor(1 × 0.20) = floor(0.20) = 0 — buffer of 0 is valid here.
    const snap = computeAgreementSnapshot({
      buddyFeePaise:      100_000,
      itineraryFundPaise: 1,
      bufferPaise:        0,
      gstRate:            0.05,
    });
    expect(snap.travelerTotalPaise).toBe(
      snap.travelerSubtotalPaise + snap.travelerGstPaise + 50_000,
    );
  });
});

// ─── Edge case: zero buddy fee ──────────────────────────────────────────────

describe('computeAgreementSnapshot — zero buddy fee', () => {
  it('computes correctly when buddyFeePaise is 0', () => {
    const itinerary = 100_000;
    const buffer    = Math.floor(itinerary * 0.20); // 20_000
    const snap = computeAgreementSnapshot({
      buddyFeePaise:      0,
      itineraryFundPaise: itinerary,
      bufferPaise:        buffer,
      gstRate:            0.05,
    });
    const expectedSubtotal = 0 + itinerary + buffer; // 120_000
    const expectedGst      = Math.round(expectedSubtotal * 0.05); // 6_000
    expect(snap.travelerSubtotalPaise).toBe(expectedSubtotal);
    expect(snap.travelerGstPaise).toBe(expectedGst);
    expect(snap.travelerTotalPaise).toBe(expectedSubtotal + expectedGst + 50_000);
  });
});

// ─── InvalidAmountError — non-integer / negative / non-finite paise ─────────

describe('computeAgreementSnapshot — InvalidAmountError', () => {
  it('throws on negative buddyFeePaise', () => {
    expect(() =>
      computeAgreementSnapshot({
        buddyFeePaise:      -1,
        itineraryFundPaise: 100_000,
        bufferPaise:        20_000,
        gstRate:            0.05,
      }),
    ).toThrow(InvalidAmountError);
  });

  it('throws on fractional itineraryFundPaise', () => {
    expect(() =>
      computeAgreementSnapshot({
        buddyFeePaise:      100_000,
        itineraryFundPaise: 100_000.5,
        bufferPaise:        20_000,
        gstRate:            0.05,
      }),
    ).toThrow(InvalidAmountError);
  });

  it('throws on NaN buddyFeePaise', () => {
    expect(() =>
      computeAgreementSnapshot({
        buddyFeePaise:      NaN,
        itineraryFundPaise: 100_000,
        bufferPaise:        20_000,
        gstRate:            0.05,
      }),
    ).toThrow(InvalidAmountError);
  });

  it('throws when gstRate is negative', () => {
    expect(() =>
      computeAgreementSnapshot({
        buddyFeePaise:      200_000,
        itineraryFundPaise: 300_000,
        bufferPaise:        60_000,
        gstRate:            -0.05,
      }),
    ).toThrow(InvalidAmountError);
  });

  it('throws when gstRate exceeds 1', () => {
    expect(() =>
      computeAgreementSnapshot({
        buddyFeePaise:      200_000,
        itineraryFundPaise: 300_000,
        bufferPaise:        60_000,
        gstRate:            1.5,
      }),
    ).toThrow(InvalidAmountError);
  });
});

// ─── Property test: total = subtotal + gst + 50000 for random valid inputs ──

describe('computeAgreementSnapshot — property: total invariant holds', () => {
  // 10 random but valid input combinations.
  const cases = [
    { buddyFee: 100_000, itinerary: 50_000  },
    { buddyFee: 500_000, itinerary: 200_000 },
    { buddyFee: 0,       itinerary: 10_000  },
    { buddyFee: 1,       itinerary: 100     },
    { buddyFee: 999_999, itinerary: 1_000_000 },
    { buddyFee: 150_000, itinerary: 75_000  },
    { buddyFee: 250_000, itinerary: 450_000 },
    { buddyFee: 50_000,  itinerary: 5_000   },
    { buddyFee: 700_000, itinerary: 300_000 },
    { buddyFee: 200_000, itinerary: 300_000 }, // canonical inputs
  ];

  test.each(cases)(
    'total = subtotal + gst + 50000 (buddyFee=%i, itinerary=%i)',
    ({ buddyFee, itinerary }) => {
      const buffer = Math.floor(itinerary * 0.20);
      const snap = computeAgreementSnapshot({
        buddyFeePaise:      buddyFee,
        itineraryFundPaise: itinerary,
        bufferPaise:        buffer,
        gstRate:            0.05,
      });
      expect(snap.travelerTotalPaise).toBe(
        snap.travelerSubtotalPaise + snap.travelerGstPaise + 50_000,
      );
    },
  );
});
