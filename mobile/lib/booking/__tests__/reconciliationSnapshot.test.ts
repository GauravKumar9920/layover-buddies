// ============================================================================
// RECONCILIATION SNAPSHOT TESTS — Phase 4
// ============================================================================
// Asserts the canonical fixture (₹2,032.50 buddy net + ₹700 traveler refund
// per handoff §2) and edge cases (over-spend cap §12 case 5, top-up handling).
// ============================================================================

import {
  computeReconciliationSnapshot,
  InvalidReconciliationInputError,
} from '../reconciliationSnapshot';
import { formatPaise } from '../money';
import { CANONICAL_AGREEMENT_INPUTS, CANONICAL_DERIVED } from '../__fixtures__/canonical';

// ─── Canonical fixture ─────────────────────────────────────────────────────

describe('computeReconciliationSnapshot — canonical fixture (worked example §2)', () => {
  const snap = computeReconciliationSnapshot({
    buddyFeePaise:        CANONICAL_AGREEMENT_INPUTS.buddyFeePaise,
    itineraryFundPaise:   CANONICAL_AGREEMENT_INPUTS.itineraryFundPaise,
    bufferPaise:          CANONICAL_AGREEMENT_INPUTS.bufferPaise,
    capturedTopUpsPaise:  0,
    declaredSpendPaise:   CANONICAL_DERIVED.spentPaise, // 340_000
  });

  it('tripPotPaise = itin + buffer + topups = ₹3,600', () => {
    expect(snap.tripPotPaise).toBe(CANONICAL_DERIVED.tripPotPaise); // 360_000
  });

  it('declaredSpendCappedPaise = min(spent, tripPot) = ₹3,400', () => {
    expect(snap.declaredSpendCappedPaise).toBe(340_000);
  });

  it('unusedBufferPaise = ₹200', () => {
    expect(snap.unusedBufferPaise).toBe(CANONICAL_DERIVED.unusedBufferPaise); // 20_000
  });

  it('buddyFeeAfterPlatformPaise = ₹1,750 (12.5% platform-down on ₹2,000)', () => {
    expect(snap.buddyFeeAfterPlatformPaise).toBe(CANONICAL_DERIVED.buddyFeeNetPaise); // 175_000
  });

  it('tdsPaise = ₹17.50 (1% TDS on ₹1,750)', () => {
    expect(snap.tdsPaise).toBe(CANONICAL_DERIVED.tdsPaise); // 1_750
  });

  it('buddyNetPaise = ₹2,032.50 (canonical)', () => {
    expect(snap.buddyNetPaise).toBe(CANONICAL_DERIVED.buddyNetPayoutPaise); // 203_250
  });

  it('travelerRefundPaise = ₹700 (₹200 buffer + ₹500 deposit)', () => {
    expect(snap.travelerRefundPaise).toBe(CANONICAL_DERIVED.travelerRefundAtEndPaise); // 70_000
  });

  it('formatPaise(buddyNetPaise) renders as ₹2,032.50', () => {
    expect(formatPaise(snap.buddyNetPaise)).toBe('₹2,032.50');
  });

  it('formatPaise(travelerRefundPaise) renders as ₹700.00', () => {
    expect(formatPaise(snap.travelerRefundPaise)).toBe('₹700.00');
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('computeReconciliationSnapshot — edge cases', () => {
  it('zero spend → all buffer comes back to traveler', () => {
    const snap = computeReconciliationSnapshot({
      buddyFeePaise:       200_000,
      itineraryFundPaise:  300_000,
      bufferPaise:         60_000,
      capturedTopUpsPaise: 0,
      declaredSpendPaise:  0,
    });
    expect(snap.unusedBufferPaise).toBe(360_000); // entire trip pot
    expect(snap.travelerRefundPaise).toBe(360_000 + 50_000);
  });

  it('exact-match spend (= trip pot) → zero unused buffer', () => {
    const snap = computeReconciliationSnapshot({
      buddyFeePaise:       200_000,
      itineraryFundPaise:  300_000,
      bufferPaise:         60_000,
      capturedTopUpsPaise: 0,
      declaredSpendPaise:  360_000,
    });
    expect(snap.unusedBufferPaise).toBe(0);
    expect(snap.travelerRefundPaise).toBe(50_000); // just the deposit
  });

  it('over-spend (§12 case 5) — capped at trip pot, no negative refund', () => {
    const snap = computeReconciliationSnapshot({
      buddyFeePaise:       200_000,
      itineraryFundPaise:  300_000,
      bufferPaise:         60_000,
      capturedTopUpsPaise: 0,
      declaredSpendPaise:  500_000, // claims to have spent more than trip pot
    });
    expect(snap.declaredSpendCappedPaise).toBe(360_000); // capped
    expect(snap.unusedBufferPaise).toBe(0);
    expect(snap.travelerRefundPaise).toBe(50_000);
  });

  it('with captured top-ups, trip pot grows accordingly', () => {
    const snap = computeReconciliationSnapshot({
      buddyFeePaise:       200_000,
      itineraryFundPaise:  300_000,
      bufferPaise:         60_000,
      capturedTopUpsPaise: 100_000, // one ₹1,000 top-up captured
      declaredSpendPaise:  400_000,
    });
    expect(snap.tripPotPaise).toBe(460_000); // 360 + 100
    expect(snap.unusedBufferPaise).toBe(60_000); // 460 − 400
    expect(snap.travelerRefundPaise).toBe(60_000 + 50_000);
  });

  it('buddyNet formula matches handoff §2 verbatim: (fee × 0.875) − tds + deposit − unusedBuffer', () => {
    const inputs = {
      buddyFeePaise:       200_000,
      itineraryFundPaise:  300_000,
      bufferPaise:         60_000,
      capturedTopUpsPaise: 0,
      declaredSpendPaise:  340_000,
    };
    const snap = computeReconciliationSnapshot(inputs);
    // 175_000 − 1_750 + 50_000 − 20_000 = 203_250
    const expected =
      snap.buddyFeeAfterPlatformPaise -
      snap.tdsPaise +
      50_000 -
      snap.unusedBufferPaise;
    expect(snap.buddyNetPaise).toBe(expected);
    expect(snap.buddyNetPaise).toBe(203_250);
  });
});

// ─── Input validation ───────────────────────────────────────────────────────

describe('computeReconciliationSnapshot — input validation', () => {
  it('throws on negative buddyFee', () => {
    expect(() => computeReconciliationSnapshot({
      buddyFeePaise: -1, itineraryFundPaise: 0, bufferPaise: 0,
      capturedTopUpsPaise: 0, declaredSpendPaise: 0,
    })).toThrow(InvalidReconciliationInputError);
  });

  it('throws on fractional itinerary', () => {
    expect(() => computeReconciliationSnapshot({
      buddyFeePaise: 0, itineraryFundPaise: 0.5, bufferPaise: 0,
      capturedTopUpsPaise: 0, declaredSpendPaise: 0,
    })).toThrow(InvalidReconciliationInputError);
  });

  it('throws on NaN top-ups', () => {
    expect(() => computeReconciliationSnapshot({
      buddyFeePaise: 0, itineraryFundPaise: 0, bufferPaise: 0,
      capturedTopUpsPaise: NaN, declaredSpendPaise: 0,
    })).toThrow(InvalidReconciliationInputError);
  });
});

// ─── Property test ──────────────────────────────────────────────────────────

describe('computeReconciliationSnapshot — invariants hold for random inputs', () => {
  const cases = [
    { fee: 100_000, itin: 100_000, buf: 20_000, tops: 0,        spent: 50_000  },
    { fee: 500_000, itin: 200_000, buf: 40_000, tops: 0,        spent: 150_000 },
    { fee: 200_000, itin: 300_000, buf: 60_000, tops: 50_000,   spent: 350_000 },
    { fee: 200_000, itin: 300_000, buf: 60_000, tops: 0,        spent: 0       },
    { fee: 100_000, itin: 50_000,  buf: 10_000, tops: 100_000,  spent: 200_000 }, // over-spend
  ];

  test.each(cases)(
    'invariants — fee=%i, itin=%i, buf=%i, tops=%i, spent=%i',
    ({ fee, itin, buf, tops, spent }) => {
      const snap = computeReconciliationSnapshot({
        buddyFeePaise: fee, itineraryFundPaise: itin, bufferPaise: buf,
        capturedTopUpsPaise: tops, declaredSpendPaise: spent,
      });
      // 1. tripPot = itin + buf + tops
      expect(snap.tripPotPaise).toBe(itin + buf + tops);
      // 2. declared capped at tripPot
      expect(snap.declaredSpendCappedPaise).toBeLessThanOrEqual(snap.tripPotPaise);
      // 3. unusedBuffer + declaredCapped = tripPot
      expect(snap.unusedBufferPaise + snap.declaredSpendCappedPaise).toBe(snap.tripPotPaise);
      // 4. travelerRefund = unusedBuffer + 50000 deposit
      expect(snap.travelerRefundPaise).toBe(snap.unusedBufferPaise + 50_000);
      // 5. buddyNet = afterPlatform − tds + 50000 − unusedBuffer
      expect(snap.buddyNetPaise).toBe(
        snap.buddyFeeAfterPlatformPaise - snap.tdsPaise + 50_000 - snap.unusedBufferPaise,
      );
    },
  );
});
