const MUMBAI_UTC_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

type DateInput = string | number | Date;

function asDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function asMumbaiDate(value: DateInput): Date {
  return new Date(asDate(value).getTime() + MUMBAI_UTC_OFFSET_MS);
}

/** Calendar date as experienced in Mumbai, independent of device timezone. */
export function formatMumbaiShortDate(value: DateInput): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(asMumbaiDate(value));
}

/** Clock time as experienced in Mumbai, independent of device timezone. */
export function formatMumbaiTime(value: DateInput): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(asMumbaiDate(value));
}
