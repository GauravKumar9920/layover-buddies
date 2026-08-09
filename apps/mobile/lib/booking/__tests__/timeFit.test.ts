import {
  computeTimeFit,
  computeLayoverPlan,
  timeFitLabel,
  interestOverlap,
  rankGuides,
  layoverHoursBetween,
  LAYOVER_OVERHEAD_MINUTES,
  TIGHT_FIT_RATIO,
} from '../timeFit';
import type { GuideProfile } from '@/types';

// Overhead is 90 min transit each way + 30 min buffer each side = 240 min.
// So a 7-hour (420 min) layover leaves exactly 180 usable minutes, which makes
// 3h the exact green/yellow boundary. Every case below is anchored to that.
describe('computeTimeFit', () => {
  it('subtracts 240 minutes of transit and buffer', () => {
    expect(LAYOVER_OVERHEAD_MINUTES).toBe(240);
  });

  it('is green when the tour fits exactly (7h layover, 3h tour)', () => {
    expect(computeTimeFit(7, 3)).toBe('green');
  });

  it('is green with room to spare', () => {
    expect(computeTimeFit(12, 3)).toBe('green');
  });

  it('is yellow just inside the tight threshold', () => {
    // 3.5h tour = 210 min; 210 * 0.8 = 168 <= 180 usable < 210
    expect(computeTimeFit(7, 3.5)).toBe('yellow');
  });

  it('is red once the tour exceeds the tight threshold', () => {
    // 4h tour = 240 min; 240 * 0.8 = 192 > 180 usable
    expect(computeTimeFit(7, 4)).toBe('red');
  });

  it('is red when overhead alone eats the layover', () => {
    expect(computeTimeFit(4, 1)).toBe('red');
  });

  it.each([
    ['null layover', null, 3],
    ['null tour', 7, null],
    ['undefined layover', undefined, 3],
    ['zero layover', 0, 3],
    ['zero tour', 7, 0],
    ['negative layover', -5, 3],
    ['negative tour', 7, -1],
  ])('returns null for %s', (_label, layover, tour) => {
    expect(computeTimeFit(layover as number, tour as number)).toBeNull();
  });

  it('honours the documented tight ratio', () => {
    expect(TIGHT_FIT_RATIO).toBe(0.8);
  });
});

describe('computeLayoverPlan', () => {
  const arrivalIso = '2026-12-01T00:00:00.000Z';
  const tenHoursLater = '2026-12-01T10:00:00.000Z';

  it('reports the window and what is usable inside it', () => {
    const plan = computeLayoverPlan({
      arrivalIso,
      departureIso: tenHoursLater,
      tourHours: 3,
    });
    expect(plan).not.toBeNull();
    expect(plan!.totalMinutes).toBe(600);
    expect(plan!.usableMinutes).toBe(360);
    expect(plan!.fit).toBe('green');
  });

  it('starts the tour after transit + buffer, and ends a tour-length later', () => {
    const plan = computeLayoverPlan({
      arrivalIso,
      departureIso: tenHoursLater,
      tourHours: 3,
    })!;
    // arrival + 90 transit + 30 buffer = +2h
    expect(plan.tourStart.toISOString()).toBe('2026-12-01T02:00:00.000Z');
    expect(plan.tourEnd.toISOString()).toBe('2026-12-01T05:00:00.000Z');
  });

  it.each([
    ['missing arrival', null, tenHoursLater, 3],
    ['missing departure', arrivalIso, null, 3],
    ['missing tour length', arrivalIso, tenHoursLater, null],
    ['unparseable arrival', 'not-a-date', tenHoursLater, 3],
    ['departure before arrival', tenHoursLater, arrivalIso, 3],
    ['zero-length window', arrivalIso, arrivalIso, 3],
  ])('returns null for %s', (_l, a, d, t) => {
    expect(
      computeLayoverPlan({
        arrivalIso: a as string,
        departureIso: d as string,
        tourHours: t as number,
      }),
    ).toBeNull();
  });

  // The booking screen used to re-implement this maths inline. The two copies
  // were only *claimed* to agree; this pins it across the whole grid.
  it('always agrees with computeTimeFit', () => {
    for (let layoverH = 1; layoverH <= 24; layoverH += 0.5) {
      for (let tourH = 0.5; tourH <= 12; tourH += 0.5) {
        const departureIso = new Date(
          Date.parse(arrivalIso) + layoverH * 3_600_000,
        ).toISOString();
        const plan = computeLayoverPlan({ arrivalIso, departureIso, tourHours: tourH });
        expect(plan?.fit ?? null).toBe(computeTimeFit(layoverH, tourH));
      }
    }
  });
});

describe('timeFitLabel', () => {
  it('returns a semantic tone, never a colour', () => {
    expect(timeFitLabel('green')).toEqual({
      text: 'Fits your layover',
      short: 'Fits',
      tone: 'success',
    });
    expect(timeFitLabel('yellow')!.tone).toBe('warning');
    expect(timeFitLabel('red')!.tone).toBe('danger');
  });

  it('returns null when there is no verdict', () => {
    expect(timeFitLabel(null)).toBeNull();
  });

  it('keeps the short form genuinely short', () => {
    for (const fit of ['green', 'yellow', 'red'] as const) {
      expect(timeFitLabel(fit)!.short.length).toBeLessThanOrEqual(10);
    }
  });
});

describe('layoverHoursBetween', () => {
  it('returns fractional hours', () => {
    expect(
      layoverHoursBetween('2026-12-01T00:00:00Z', '2026-12-01T07:30:00Z'),
    ).toBe(7.5);
  });

  it.each([
    ['missing arrival', null, '2026-12-01T07:00:00Z'],
    ['missing departure', '2026-12-01T00:00:00Z', null],
    ['departure before arrival', '2026-12-01T07:00:00Z', '2026-12-01T00:00:00Z'],
    ['identical instants', '2026-12-01T00:00:00Z', '2026-12-01T00:00:00Z'],
    ['unparseable', 'nope', '2026-12-01T07:00:00Z'],
  ])('returns null for %s', (_l, a, d) => {
    expect(layoverHoursBetween(a as string, d as string)).toBeNull();
  });
});

// Untested before this change, despite driving the order of the Explore feed.
describe('interestOverlap', () => {
  it('matches case-insensitively in both directions', () => {
    expect(interestOverlap(['Foodie', 'History'], ['food'])).toBe(1);
    expect(interestOverlap(['food'], ['Food & Street Eats'])).toBe(1);
  });

  it('counts each traveler interest at most once', () => {
    expect(interestOverlap(['food', 'foodie', 'street food'], ['food'])).toBe(1);
  });

  it.each([
    ['no guide skills', [], ['food']],
    ['no traveler interests', ['food'], []],
    ['null guide skills', null, ['food']],
    ['null traveler interests', ['food'], null],
    ['no overlap', ['nightlife'], ['history']],
  ])('returns 0 for %s', (_l, skills, interests) => {
    expect(interestOverlap(skills as string[], interests as string[])).toBe(0);
  });
});

describe('rankGuides', () => {
  const guide = (over: Partial<GuideProfile> & { id: string }) =>
    ({ categories: [], avg_rating: 0, total_reviews: 0, ...over }) as GuideProfile;

  it('puts interest overlap ahead of rating', () => {
    const ranked = rankGuides(
      [
        guide({ id: 'high-rating', categories: ['nightlife'], avg_rating: 5 }),
        guide({ id: 'matches', categories: ['food'], avg_rating: 1 }),
      ],
      ['food'],
    );
    expect(ranked.map((g) => g.id)).toEqual(['matches', 'high-rating']);
  });

  it('falls back to rating, then review count', () => {
    const ranked = rankGuides(
      [
        guide({ id: 'few-reviews', avg_rating: 4, total_reviews: 2 }),
        guide({ id: 'many-reviews', avg_rating: 4, total_reviews: 90 }),
        guide({ id: 'best-rated', avg_rating: 5, total_reviews: 1 }),
      ],
      [],
    );
    expect(ranked.map((g) => g.id)).toEqual([
      'best-rated',
      'many-reviews',
      'few-reviews',
    ]);
  });

  it('filters nobody out', () => {
    const guides = [guide({ id: 'a' }), guide({ id: 'b' })];
    expect(rankGuides(guides, ['food'])).toHaveLength(2);
  });
});
