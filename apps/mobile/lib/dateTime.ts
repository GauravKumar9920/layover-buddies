const MUMBAI_TIME_ZONE = 'Asia/Kolkata';

type DateInput = string | number | Date;

function asDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Calendar date as experienced in Mumbai, independent of device timezone. */
export function formatMumbaiShortDate(value: DateInput): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MUMBAI_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  }).format(asDate(value));
}

/** Clock time as experienced in Mumbai, independent of device timezone. */
export function formatMumbaiTime(value: DateInput): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MUMBAI_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(asDate(value));
}
