// ============================================================================
// TOUR PRICING — base charge + per-person charge
// ============================================================================
// A Buddy sets two numbers on an itinerary:
//
//   base_cost   flat, charged once per booking. Covers the fixed effort —
//               planning the day, showing up — which does not scale with heads.
//   buddy_cost  per person. Scales with the party.
//
// A party of N pays  base + perPerson * N.
//
// Legacy itineraries have base = 0, so every formula here collapses to the old
// perPerson * N and every existing tour renders exactly as it did before.
//
// All amounts are RUPEES (matching itineraries.buddy_cost / base_cost, which
// are DECIMAL(10,2)). Paise conversion lives in money.ts and happens only at
// the agreement boundary.
// ============================================================================

import { MAX_PARTY_SIZE } from '@/config/profileOptions';

/** Rupee amount with Indian digit grouping: 5300 → "₹5,300". */
export function formatRupees(amount: number): string {
  const rounded = Math.round(amount);
  return `₹${rounded.toLocaleString('en-IN')}`;
}

/** Party size coerced into the range the platform actually supports. */
export function clampPartySize(n: number | null | undefined): number {
  if (!Number.isFinite(n ?? NaN)) return 1;
  return Math.max(1, Math.min(MAX_PARTY_SIZE, Math.round(n as number)));
}

/**
 * What the Buddy earns for a party of `partySize`, before platform fees.
 * This is the number that drives the browse estimate AND seeds the agreement
 * draft, so the price a traveler saw and the fee the Buddy proposes start
 * from the same place.
 */
export function tourBuddyFeeInr(
  baseInr: number | null | undefined,
  perPersonInr: number | null | undefined,
  partySize: number | null | undefined,
): number {
  const base = Math.max(0, baseInr ?? 0);
  const perPerson = Math.max(0, perPersonInr ?? 0);
  return base + perPerson * clampPartySize(partySize);
}

/**
 * The pricing shape, spelled out. Used where there is room for a full line.
 *   base and per-person → "₹500 + ₹1,200/person"
 *   per-person only     → "₹1,200/person"      (legacy rows: unchanged copy)
 *   base only           → "₹500 flat"
 */
export function formatTourPrice(
  baseInr: number | null | undefined,
  perPersonInr: number | null | undefined,
): string {
  const base = Math.max(0, baseInr ?? 0);
  const perPerson = Math.max(0, perPersonInr ?? 0);
  if (base > 0 && perPerson > 0) {
    return `${formatRupees(base)} + ${formatRupees(perPerson)}/person`;
  }
  if (perPerson > 0) return `${formatRupees(perPerson)}/person`;
  if (base > 0) return `${formatRupees(base)} flat`;
  return '—';
}

/**
 * Single-number surfaces (card prices, "From" stats): what one traveler pays.
 * Deliberately the party-of-one total rather than the per-person component, so
 * a base-heavy tour never advertises a price nobody can actually book at.
 */
export function tourFromPriceInr(
  baseInr: number | null | undefined,
  perPersonInr: number | null | undefined,
): number {
  return tourBuddyFeeInr(baseInr, perPersonInr, 1);
}

export function formatFromPrice(
  baseInr: number | null | undefined,
  perPersonInr: number | null | undefined,
): string {
  return formatRupees(tourFromPriceInr(baseInr, perPersonInr));
}

/** Guide-facing preview line: "A party of 4 pays ₹5,300". */
export function formatPartyTotal(
  baseInr: number | null | undefined,
  perPersonInr: number | null | undefined,
  partySize: number,
): string {
  const n = clampPartySize(partySize);
  const total = formatRupees(tourBuddyFeeInr(baseInr, perPersonInr, n));
  return `A party of ${n} pays ${total}`;
}

/** Every supported party size and its total — the guide's price preview strip. */
export function partyPriceLadder(
  baseInr: number | null | undefined,
  perPersonInr: number | null | undefined,
): { size: number; total: number; label: string }[] {
  return Array.from({ length: MAX_PARTY_SIZE }, (_, i) => {
    const size = i + 1;
    const total = tourBuddyFeeInr(baseInr, perPersonInr, size);
    return { size, total, label: formatRupees(total) };
  });
}
