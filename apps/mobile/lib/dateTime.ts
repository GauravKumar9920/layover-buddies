// Hermes ships without full ICU, so `Intl.DateTimeFormat` throws
// `RangeError: Incorrect timeZone information provided` for any named IANA
// zone — only 'UTC' is accepted. We shift the instant by Mumbai's fixed
// +05:30 offset and read it back in UTC. India has no DST, so the offset is
// constant and this stays exact.
const MUMBAI_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

type DateInput = string | number | Date;

function asDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function asMumbaiDate(value: DateInput): Date {
  return new Date(asDate(value).getTime() + MUMBAI_OFFSET_MS);
}

/** Calendar date as experienced in Mumbai, independent of device timezone. */
export function formatMumbaiShortDate(value: DateInput): string {
  const date = asMumbaiDate(value);
  return `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Clock time as experienced in Mumbai, independent of device timezone. */
export function formatMumbaiTime(value: DateInput): string {
  const date = asMumbaiDate(value);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}
