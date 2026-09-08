// ============================================================================
// IST WALL-CLOCK ↔ UTC INSTANT
// ============================================================================
// Every trip time the traveler types is a Mumbai wall-clock reading ("I land
// at 08:30"). The database stores true-UTC instants. These two functions are
// the only sanctioned conversion between the two, and they are exact inverses:
//
//     istPartsFromIso(toMumbaiIso(date, time)) === { date, time }
//
// That round-trip is what makes prefilling a form from a stored layover safe,
// which is why it is pinned by a property test rather than a couple of
// examples. India has never observed DST, so a fixed +5:30 offset is total —
// there is no ambiguous or non-existent local time to handle.
//
// Previously this logic existed three times: toMumbaiIso in
// LayoverEditorModal, istParts in book/[guideId].tsx, and a third variant in
// lib/api/bookings.ts. Two copies drifting apart would silently shift a
// traveler's layover by 5.5 hours.
// ============================================================================

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60_000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export interface IstParts {
  /** `YYYY-MM-DD`, Mumbai calendar date. */
  date: string;
  /** `HH:mm`, 24-hour Mumbai wall clock. */
  time: string;
}

/** True when the pair is shaped like the picker output these helpers expect. */
export function isIstParts(date: string, time: string): boolean {
  return DATE_RE.test(date) && TIME_RE.test(time);
}

/**
 * Mumbai wall clock → UTC instant, as an ISO string.
 * Returns `null` for malformed input rather than an Invalid Date, so callers
 * fail loudly at the boundary instead of writing `null` into a timestamptz.
 */
export function toMumbaiIso(date: string, time: string): string | null {
  if (!isIstParts(date, time)) return null;
  const utcMs =
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      Number(time.slice(0, 2)),
      Number(time.slice(3, 5)),
    ) - IST_OFFSET_MS;
  if (!Number.isFinite(utcMs)) return null;
  return new Date(utcMs).toISOString();
}

/**
 * UTC instant → Mumbai wall clock, the inverse of {@link toMumbaiIso}.
 * Shift by the offset, then read the UTC fields — never the local ones, which
 * would make the result depend on the device's timezone.
 */
export function istPartsFromIso(iso: string | null | undefined): IstParts | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const shifted = new Date(ms + IST_OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** Minutes between two ISO instants, or `null` if either is unusable. */
export function minutesBetweenIso(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): number | null {
  if (!startIso || !endIso) return null;
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 60_000);
}
