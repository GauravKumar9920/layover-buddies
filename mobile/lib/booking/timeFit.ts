// ============================================================================
// TIME-FIT + INTEREST-RANKING HELPERS
// ============================================================================
// Pure functions used by Explore + guide profile + itinerary detail to:
//
//   1. computeTimeFit(layoverHours, tourHours)
//        → 'green' | 'yellow' | 'red'
//      Mirrors the DayOverview math on the booking screen so users see the
//      *same* zone everywhere. Bakes in transit buffers (90 min each way)
//      and a 30-min pre/post tour buffer.
//
//   2. rankGuides(guides, interests)
//        → Guide[] sorted by interest overlap, then rating, then review count
//      Soft ranking — guides whose skills overlap with the traveler's
//      interests bubble up, but nobody is filtered out.
//
//   3. interestOverlap(guideSkills, travelerInterests)
//        → number of matching tags (case-insensitive substring)
//      Exported separately so guide cards can show a "matches 2 of your
//      interests" hint.
// ============================================================================

import type { GuideProfile } from '@/types';

export type TimeFit = 'green' | 'yellow' | 'red';

const TRANSIT_BUFFER_MINUTES = 90; // each way, airport ↔ city
const TOUR_BUFFER_MINUTES    = 30; // pre + post

/**
 * Returns the colour zone for a tour of `tourHours` against a layover of
 * `layoverHours`. `null` when either input is missing — caller hides the
 * badge in that case.
 */
export function computeTimeFit(
  layoverHours: number | null | undefined,
  tourHours:    number | null | undefined,
): TimeFit | null {
  if (!layoverHours || !tourHours || layoverHours <= 0 || tourHours <= 0) return null;
  const totalMin     = layoverHours * 60;
  const usableMin    = totalMin - TRANSIT_BUFFER_MINUTES * 2 - TOUR_BUFFER_MINUTES * 2;
  const tourMin      = tourHours * 60;
  if (usableMin >= tourMin)        return 'green';
  if (usableMin >= tourMin * 0.8)  return 'yellow';
  return 'red';
}

/** Visible glyph + label for a TimeFit. Keep the strings short — they sit on a chip. */
export function timeFitLabel(fit: TimeFit | null): { emoji: string; text: string; tone: string } | null {
  if (!fit) return null;
  if (fit === 'green')  return { emoji: '✅', text: 'Fits your layover',  tone: '#16A34A' };
  if (fit === 'yellow') return { emoji: '⚠️', text: 'Tight, but doable', tone: '#D97706' };
  return                       { emoji: '❌', text: 'Won\'t fit',          tone: '#DC2626' };
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
    rating:  g.avg_rating ?? 0,
    reviews: g.total_reviews ?? 0,
  }));
  scored.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    if (b.rating  !== a.rating)  return b.rating  - a.rating;
    return b.reviews - a.reviews;
  });
  return scored.map((s) => s.g);
}

/**
 * Convenience: from a `traveler_profiles.arrival_at` + `departure_at`,
 * compute hours-of-layover as a float. Returns null when either is missing.
 */
export function layoverHoursBetween(
  arrivalIso:   string | null | undefined,
  departureIso: string | null | undefined,
): number | null {
  if (!arrivalIso || !departureIso) return null;
  const a = Date.parse(arrivalIso);
  const d = Date.parse(departureIso);
  if (Number.isNaN(a) || Number.isNaN(d) || d <= a) return null;
  return (d - a) / 3_600_000;
}
