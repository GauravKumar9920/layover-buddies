import {
  tourBuddyFeeInr,
  formatTourPrice,
  formatFromPrice,
  formatPartyTotal,
  formatRupees,
  clampPartySize,
  partyPriceLadder,
  tourFromPriceInr,
} from '../tourPricing';
import { MAX_PARTY_SIZE } from '@/config/profileOptions';

describe('tourBuddyFeeInr', () => {
  it('adds the flat base to the per-person charge times the party', () => {
    expect(tourBuddyFeeInr(500, 1200, 4)).toBe(5300); // 500 + 1200*4
    expect(tourBuddyFeeInr(500, 1200, 1)).toBe(1700);
  });

  // The migration gives every pre-existing itinerary base_cost = 0, so the
  // whole feature has to be a no-op on legacy data.
  it('collapses to the legacy perPerson * N when base is 0', () => {
    for (let n = 1; n <= MAX_PARTY_SIZE; n++) {
      expect(tourBuddyFeeInr(0, 1200, n)).toBe(1200 * n);
    }
  });

  it('supports a flat-fee tour with no per-person charge', () => {
    expect(tourBuddyFeeInr(2000, 0, 3)).toBe(2000);
  });

  it('clamps the party size to what the platform supports', () => {
    expect(tourBuddyFeeInr(0, 100, 99)).toBe(100 * MAX_PARTY_SIZE);
    expect(tourBuddyFeeInr(0, 100, 0)).toBe(100);
    expect(tourBuddyFeeInr(0, 100, -3)).toBe(100);
  });

  it('treats missing or negative components as zero', () => {
    expect(tourBuddyFeeInr(null, 1200, 2)).toBe(2400);
    expect(tourBuddyFeeInr(500, null, 2)).toBe(500);
    expect(tourBuddyFeeInr(-500, 1200, 2)).toBe(2400);
    expect(tourBuddyFeeInr(undefined, undefined, 2)).toBe(0);
  });
});

describe('clampPartySize', () => {
  it.each([
    [1, 1],
    [4, 4],
    [5, MAX_PARTY_SIZE],
    [0, 1],
    [-2, 1],
    [2.4, 2],
    [2.6, 3],
  ])('clamps %p to %p', (input, expected) => {
    expect(clampPartySize(input)).toBe(expected);
  });

  it('falls back to 1 for non-numbers', () => {
    expect(clampPartySize(null)).toBe(1);
    expect(clampPartySize(undefined)).toBe(1);
    expect(clampPartySize(NaN)).toBe(1);
  });
});

describe('formatRupees', () => {
  it('uses Indian digit grouping', () => {
    expect(formatRupees(5300)).toBe('₹5,300');
    expect(formatRupees(150000)).toBe('₹1,50,000');
  });

  it('rounds to whole rupees', () => {
    expect(formatRupees(1200.4)).toBe('₹1,200');
    expect(formatRupees(1200.5)).toBe('₹1,201');
  });
});

describe('formatTourPrice', () => {
  it('spells out both components when both are set', () => {
    expect(formatTourPrice(500, 1200)).toBe('₹500 + ₹1,200/person');
  });

  // Legacy rows must render byte-identically to how they always have.
  it('shows per-person only when there is no base', () => {
    expect(formatTourPrice(0, 1200)).toBe('₹1,200/person');
    expect(formatTourPrice(null, 1200)).toBe('₹1,200/person');
  });

  it('shows a flat price when there is no per-person charge', () => {
    expect(formatTourPrice(2000, 0)).toBe('₹2,000 flat');
  });

  it('degrades to a dash when the tour is unpriced', () => {
    expect(formatTourPrice(0, 0)).toBe('—');
  });
});

describe('formatFromPrice', () => {
  // A base-heavy tour must never advertise a number nobody can book at.
  it('quotes what one traveler actually pays, base included', () => {
    expect(formatFromPrice(500, 1200)).toBe('₹1,700');
    expect(tourFromPriceInr(500, 1200)).toBe(1700);
  });

  it('matches the old single-price display for legacy rows', () => {
    expect(formatFromPrice(0, 1200)).toBe('₹1,200');
  });
});

describe('formatPartyTotal', () => {
  it('reads as a sentence', () => {
    expect(formatPartyTotal(500, 1200, 4)).toBe('A party of 4 pays ₹5,300');
  });

  it('clamps the size it reports as well as the price', () => {
    expect(formatPartyTotal(0, 100, 99)).toBe(
      `A party of ${MAX_PARTY_SIZE} pays ₹${(100 * MAX_PARTY_SIZE).toLocaleString('en-IN')}`,
    );
  });
});

describe('partyPriceLadder', () => {
  it('covers every supported party size', () => {
    const ladder = partyPriceLadder(500, 1200);
    expect(ladder).toHaveLength(MAX_PARTY_SIZE);
    expect(ladder.map((r) => r.size)).toEqual([1, 2, 3, 4]);
    expect(ladder.map((r) => r.total)).toEqual([1700, 2900, 4100, 5300]);
    expect(ladder[3].label).toBe('₹5,300');
  });

  it('is flat across the ladder for a base-only tour', () => {
    expect(partyPriceLadder(2000, 0).map((r) => r.total)).toEqual([
      2000, 2000, 2000, 2000,
    ]);
  });
});
