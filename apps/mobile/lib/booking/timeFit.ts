// ============================================================================
// TIME-FIT + INTEREST-RANKING HELPERS
// ============================================================================
// Pure functions used by Explore, search, the guide profile, itinerary detail
// and the booking screen to answer one question: does this tour fit inside the
// traveler's layover?
//
//   1. computeTimeFit(layoverHours, tourHours) → 'green' | 'yellow' | 'red'
//        The three-stage verdict. Bakes in transit buffers (90 min each way,
//        airport ↔ city) and a 30-min pre/post tour buffer.
//
//   2. computeLayoverPlan({ arrivalIso, departureIso, tourHours })
//        The same maths, plus the actual clock times the tour would occupy.
//        Single source for the fit chip, the booking screen's day timeline,
//        and the tour_start_time/tour_end_time written onto a booking — so
//        all three can never disagree.
//
//   3. timeFitLabel(fit) → { text, short, tone }
//        `tone` is a SEMANTIC token, not a colour. Mapping it to a palette is
//        the chip component's job; keeping it out of here means this module
//        stays pure and testable, and there is exactly one place where the
//        green/amber/red hexes live.
//
//   4. rankGuides / interestOverlap — soft ranking for the Explore feed.
// ============================================================================

import type { GuideProfile } from '@/types';

export type TimeFit = 'green' | 'yellow' | 'red';

/** Airport ↔ city, each way. */
export const TRANSIT_BUFFER_MINUTES = 90;
/** Breathing room before and after the tour itself. */
export const TOUR_BUFFER_MINUTES = 30;
/** Above this fraction of the tour length, a near-miss reads as "tight". */
export const TIGHT_FIT_RATIO = 0.8;

/** Total overhead subtracted from a layover before any touring can happen. */
export const LAYOVER_OVERHEAD_MINUTES =
  TRANSIT_BUFFER_MINUTES * 2 + TOUR_BUFFER_MINUTES * 2;

/**
 * Returns the colour zone for a tour of `tourHours` against a layover of
 * `layoverHours`. `null` when either input is missing — the caller hides the
 * badge in that case rather than guessing a duration.
 */
export function computeTimeFit(
  layoverHours: number | null | undefined,
  tourHours: number | null | undefined,
): TimeFit | null {
  if (!layoverHours || !tourHours || layoverHours <= 0 || tourHours <= 0) return null;
  const usableMin = layoverHours * 60 - LAYOVER_OVERHEAD_MINUTES;
  const tourMin = tourHours * 60;
  if (usableMin >= tourMin) return 'green';
  if (usableMin >= tourMin * TIGHT_FIT_RATIO) return 'yellow';
  return 'red';
}

export interface LayoverPlan {
  /** Whole layover, arrival → departure. */
  totalMinutes: number;
  /** What's left for touring once transit and buffers are removed. */
  usableMinutes: number;
  /** Earliest the tour could realistically start. */
  tourStart: Date;
  /** When it would end, given the tour's own length. */
  tourEnd: Date;
  fit: TimeFit;
}

/**
 * The full picture for a concrete layover: the verdict plus the clock times.
 * Returns `null` when the window is unusable or either input is missing.
 *
 * `fit` here is guaranteed identical to `computeTimeFit(hours, tourHours)` —
 * pinned by a property test, because the booking screen used to re-implement
 * this maths inline and the two copies were only claimed to agree.
 */
export function computeLayoverPlan(input: {
  arrivalIso: string | null | undefined;
  departureIso: string | null | undefined;
  tourHours: number | null | undefined;
}): LayoverPlan | null {
  const { arrivalIso, departureIso, tourHours } = input;
  if (!tourHours || tourHours <= 0) return null;

  const arrivalMs = arrivalIso ? Date.parse(arrivalIso) : NaN;
  const departureMs = departureIso ? Date.parse(departureIso) : NaN;
  if (Number.isNaN(arrivalMs) || Number.isNaN(departureMs)) return null;

  const totalMinutes = Math.round((departureMs - arrivalMs) / 60_000);
  if (totalMinutes <= 0) return null;

  const fit = computeTimeFit(totalMinutes / 60, tourHours);
  if (!fit) return null;

  const tourStart = new Date(
    arrivalMs + (TRANSIT_BUFFER_MINUTES + TOUR_BUFFER_MINUTES) * 60_000,
  );
  const tourEnd = new Date(tourStart.getTime() + tourHours * 60 * 60_000);

  return {
    totalMinutes,
    usableMinutes: totalMinutes - LAYOVER_OVERHEAD_MINUTES,
    tourStart,
    tourEnd,
    fit,
  };
}

/** Semantic tone. The chip maps this to theme colours — see TimeFitChip. */
export type TimeFitTone = 'success' | 'warning' | 'danger';

export interface TimeFitLabel {
  /** Full phrasing, for cards with room. */
  text: string;
  /** Terse phrasing, for dense rows and image overlays. */
  short: string;
  tone: TimeFitTone;
}

/** Copy + tone for a verdict. Keep the strings short — they sit on a chip. */
export function timeFitLabel(fit: TimeFit | null): TimeFitLabel | null {
  if (!fit) return null;
  if (fit === 'green') {
    return { text: 'Fits your layover', short: 'Fits', tone: 'success' };
  }
  if (fit === 'yellow') {
    return { text: 'Tight, but doable', short: 'Tight', tone: 'warning' };
  }
  return { text: "Won't fit your layover", short: "Won't fit", tone: 'danger' };
}

/**
 * How many of the traveler's interests overlap with the guide's skills.
 * Case-insensitive substring match — "Foodie" matches interest "food".
 */
export function interestOverlap(
  guideSkillNames: string[] | undefined | null,
  travelerInterests: string[] | undefined | null,
): number {
  if (!guideSkillNames?.length || !travelerInterests?.length) return 0;
  const norm = (s: string) => s.toLowerCase();
  const skills = guideSkillNames.map(norm);
  return travelerInterests.filter((i) =>
    skills.some((s) => s.includes(norm(i)) || norm(i).includes(s)),
  ).length;
}

/**
 * Soft-ranks guides for the Explore feed. Order:
 *   1. Higher interest overlap first
 *   2. Then higher average rating
 *   3. Then more total reviews (a tie-breaker that nudges established guides up)
 */
export function rankGuides<G extends GuideProfile>(
  guides: G[],
  travelerInterests: string[] | undefined | null,
): G[] {
  const scored = guides.map((g) => ({
    g,
    overlap: interestOverlap(g.categories, travelerInterests),
    rating: g.avg_rating ?? 0,
    reviews: g.total_reviews ?? 0,
  }));
  scored.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.reviews - a.reviews;
  });
  return scored.map((s) => s.g);
}

/**
 * Convenience: from a layover's `arrival_at` + `departure_at`, compute
 * hours-of-layover as a float. Returns null when either is missing.
 */
export function layoverHoursBetween(
  arrivalIso: string | null | undefined,
  departureIso: string | null | undefined,
): number | null {
  if (!arrivalIso || !departureIso) return null;
  const a = Date.parse(arrivalIso);
  const d = Date.parse(departureIso);
  if (Number.isNaN(a) || Number.isNaN(d) || d <= a) return null;
  return (d - a) / 3_600_000;
}
