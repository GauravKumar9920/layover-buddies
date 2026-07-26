import { formatMumbaiShortDate, formatMumbaiTime } from '../dateTime';

describe('Mumbai date/time formatting', () => {
  it('uses Asia/Kolkata across a UTC date boundary', () => {
    const instant = '2026-07-26T20:30:00.000Z';

    expect(formatMumbaiShortDate(instant)).toBe('Jul 27');
    expect(formatMumbaiTime(instant)).toBe('2:00 AM');
  });
});
