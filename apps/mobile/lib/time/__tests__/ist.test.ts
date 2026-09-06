import {
  toMumbaiIso,
  istPartsFromIso,
  isIstParts,
  minutesBetweenIso,
} from '../ist';

describe('toMumbaiIso', () => {
  it('treats the input as a Mumbai wall clock and returns the UTC instant', () => {
    // 08:30 IST is 03:00 UTC the same day.
    expect(toMumbaiIso('2026-12-01', '08:30')).toBe('2026-12-01T03:00:00.000Z');
  });

  it('rolls back a day when the IST time is before 05:30', () => {
    // 03:00 IST is 21:30 UTC the PREVIOUS day — the case that silently shifts
    // a traveler's layover if anyone reaches for local date parts instead.
    expect(toMumbaiIso('2026-12-01', '03:00')).toBe('2026-11-30T21:30:00.000Z');
  });

  it.each([
    ['bad date shape', '01-12-2026', '08:30'],
    ['bad time shape', '2026-12-01', '8:30'],
    ['empty date', '', '08:30'],
    ['empty time', '2026-12-01', ''],
    ['time with seconds', '2026-12-01', '08:30:00'],
  ])('returns null for %s rather than an Invalid Date', (_l, d, t) => {
    expect(toMumbaiIso(d, t)).toBeNull();
  });
});

describe('istPartsFromIso', () => {
  it('is the inverse of toMumbaiIso', () => {
    expect(istPartsFromIso('2026-12-01T03:00:00.000Z')).toEqual({
      date: '2026-12-01',
      time: '08:30',
    });
  });

  it('rolls forward a day across the UTC midnight boundary', () => {
    expect(istPartsFromIso('2026-11-30T21:30:00.000Z')).toEqual({
      date: '2026-12-01',
      time: '03:00',
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['unparseable', 'not-a-date'],
  ])('returns null for %s', (_l, iso) => {
    expect(istPartsFromIso(iso as string)).toBeNull();
  });
});

// The whole point of extracting these: the layover prefill on the booking
// screen is only correct if they are exact inverses. India has never observed
// DST, so a fixed +5:30 offset makes this round-trip total — every wall clock
// maps to exactly one instant and back.
describe('round-trip', () => {
  it('survives every half-hour of a day, across a month boundary', () => {
    for (const date of ['2026-11-30', '2026-12-01', '2027-01-01', '2026-02-28']) {
      for (let h = 0; h < 24; h++) {
        for (const m of ['00', '30']) {
          const time = `${String(h).padStart(2, '0')}:${m}`;
          const iso = toMumbaiIso(date, time);
          expect(iso).not.toBeNull();
          expect(istPartsFromIso(iso)).toEqual({ date, time });
        }
      }
    }
  });

  it('survives a leap day', () => {
    const iso = toMumbaiIso('2028-02-29', '00:15');
    expect(istPartsFromIso(iso)).toEqual({ date: '2028-02-29', time: '00:15' });
  });
});

describe('isIstParts', () => {
  it('accepts the picker output shape', () => {
    expect(isIstParts('2026-12-01', '08:30')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isIstParts('2026-12-1', '08:30')).toBe(false);
    expect(isIstParts('2026-12-01', '830')).toBe(false);
  });
});

describe('minutesBetweenIso', () => {
  it('measures the window', () => {
    expect(
      minutesBetweenIso('2026-12-01T00:00:00Z', '2026-12-01T07:30:00Z'),
    ).toBe(450);
  });

  it('goes negative when the order is reversed', () => {
    expect(
      minutesBetweenIso('2026-12-01T07:30:00Z', '2026-12-01T00:00:00Z'),
    ).toBe(-450);
  });

  it.each([
    ['missing start', null, '2026-12-01T07:00:00Z'],
    ['missing end', '2026-12-01T00:00:00Z', null],
    ['unparseable', 'nope', '2026-12-01T07:00:00Z'],
  ])('returns null for %s', (_l, a, b) => {
    expect(minutesBetweenIso(a as string, b as string)).toBeNull();
  });
});
