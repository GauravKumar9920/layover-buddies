// ============================================================================
// PUSH COPY — title / body / deep_link per notification kind
// ============================================================================
// Pure helpers used by the send-push Edge function and unit-tested in Deno.
// Every notification kind emitted by Phase 3+4 cron jobs has an entry here.
// Unknown kinds fall back to a generic title/body so a stale payload never
// crashes the sender.
// ============================================================================

export type NotificationPayload = Record<string, unknown>;

const RUPEE = '₹'; // ₹

// ── Helpers ─────────────────────────────────────────────────────────────────

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

function paiseToINR(paise: unknown): string | null {
  const n = toInt(paise);
  if (n === null) return null;
  // Format with thousands separator (en-IN). Strip trailing .00 for round amounts.
  const rupees = n / 100;
  const isWhole = rupees === Math.trunc(rupees);
  return isWhole
    ? rupees.toLocaleString('en-IN')
    : rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hoursLabel(hours: unknown): string {
  const n = typeof hours === 'number' ? hours : Number(hours);
  if (!Number.isFinite(n)) return '';
  if (n >= 1) return `${Math.round(n)}h`;
  return `${Math.max(1, Math.round(n * 60))}m`;
}

// ── Title ───────────────────────────────────────────────────────────────────

export function pushTitleFor(kind: string): string {
  switch (kind) {
    case 'balance_reminder_84h':
    case 'balance_reminder_48h':
    case 'balance_reminder_24h':
    case 'balance_reminder_18h':
      return 'Pay your trip balance';
    case 'late_fee_assessed':
      return 'Late-fee added';
    case 'no_pay_cancelled':
      return 'Booking cancelled';
    case 'proofs_overdue':
      return 'Upload your proofs';
    case 'rating_link':
    case 'rating_prompt':
      return 'How was your trip?';
    case 'top_up_request':
      return 'Buddy needs more buffer';
    case 'sos_alert':
    case 'sos_triggered':
      return '🚨 SOS alert';
    default:
      return 'Detour';
  }
}

// ── Body ────────────────────────────────────────────────────────────────────

export function pushBodyFor(kind: string, payload: NotificationPayload | null | undefined): string {
  const p = payload ?? {};

  switch (kind) {
    case 'balance_reminder_84h':
    case 'balance_reminder_48h':
    case 'balance_reminder_24h':
    case 'balance_reminder_18h': {
      const hrs = hoursLabel(p['hours_until_trip']);
      return hrs
        ? `Your trip starts in ${hrs}. Tap to pay your balance and confirm.`
        : 'Tap to pay your balance and confirm your trip.';
    }
    case 'late_fee_assessed': {
      const fee = paiseToINR(p['late_fee_paise']) ?? '1,000';
      return `Balance is past due. ${RUPEE}${fee} late fee added — tap to pay.`;
    }
    case 'no_pay_cancelled':
      return 'Your booking was cancelled because the balance went unpaid before T-12h.';
    case 'proofs_overdue':
      return 'Trip ended over 24h ago. Upload your expense proofs to settle up.';
    case 'rating_link':
    case 'rating_prompt':
      return 'Tap to rate your buddy and finalise the trip.';
    case 'top_up_request': {
      const purpose = typeof p['purpose'] === 'string' ? (p['purpose'] as string) : 'extra buffer';
      const amt = paiseToINR(p['requested_paise']);
      return amt
        ? `${purpose} — ${RUPEE}${amt}. Tap to approve or decline.`
        : `${purpose}. Tap to approve or decline.`;
    }
    case 'sos_alert':
    case 'sos_triggered': {
      const who = typeof p['triggered_by_name'] === 'string' ? (p['triggered_by_name'] as string) : 'A traveler';
      return `${who} triggered an SOS. Tap to open the trip and their location.`;
    }
    default:
      return 'You have a new notification.';
  }
}

// ── Deep link ───────────────────────────────────────────────────────────────

/**
 * Build a fallback deep_link when notifications.deep_link is null.
 * Returns the empty string if no sensible default applies (caller should skip
 * setting the data.deep_link key in that case).
 */
export function deepLinkFor(kind: string, bookingId: string | null | undefined): string {
  if (!bookingId) return '';

  switch (kind) {
    case 'balance_reminder_84h':
    case 'balance_reminder_48h':
    case 'balance_reminder_24h':
    case 'balance_reminder_18h':
    case 'late_fee_assessed':
      return `/trips/balance/${bookingId}`;
    case 'top_up_request':
      return `/trips/live/${bookingId}`;
    case 'rating_link':
    case 'rating_prompt':
      return `/trips/review/${bookingId}`;
    case 'proofs_overdue':
      return `/bookings/upload-proofs/${bookingId}`;
    case 'no_pay_cancelled':
      return `/trips/cancellation-receipt/${bookingId}`;
    case 'sos_alert':
    case 'sos_triggered':
      return `/trips/live/${bookingId}`;
    default:
      return `/trips/${bookingId}`;
  }
}
