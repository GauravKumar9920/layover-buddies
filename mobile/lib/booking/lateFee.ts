// ============================================================================
// LATE FEE EVALUATION — Phase 3 pure helper
// ============================================================================
// Single helper for determining whether a booking is in the late-fee window
// based on the agreed trip start time and the current time. Used by:
//   - The balance-payment screen (banner + amount calculation).
//   - cta.ts for the late_fee_due CTA label.
//   - mobile-side mirror of the cron_late_fee_assess decision (for UX preview
//     before the cron fires; the cron is the source of truth).
//
// Time math is intentionally non-clock-aware: just diff hours between two
// Date objects. Boundary semantics: "within 72h" means strictly less than 72.
// ============================================================================

import { LATE_FEE_PAISE, T_MINUS_72_HOURS, T_MINUS_12_HOURS } from '@/config/constants';

export interface LateFeeEvaluation {
  /** True when trip start is strictly less than 72h away (T-72h cutoff hit). */
  inLateFeeWindow: boolean;
  /** True when trip start is strictly less than 12h away (auto-cancel cutoff). */
  inNoPayCancelWindow: boolean;
  /** Hours until trip start. Negative if trip is in the past. */
  hoursUntilTrip: number;
  /** True when caller should accrue the late fee (in window AND not yet assessed). */
  shouldAccrue: boolean;
  /** Late fee in paise (always returns LATE_FEE_PAISE — included for callers). */
  lateFeePaise: number;
}

/**
 * Evaluate the late-fee state of a booking given trip start and current time.
 * Pure: no side effects, no clock reads — caller passes `now` so tests can
 * pin it.
 *
 * @param tripStartsAt the agreement's trip_starts_at
 * @param now the current time (or a test-pinned value)
 * @param alreadyAssessed whether late_fee_assessed_at is non-null on the booking
 */
export function evaluateLateFee(
  tripStartsAt: Date,
  now: Date,
  alreadyAssessed = false,
): LateFeeEvaluation {
  const msUntilTrip = tripStartsAt.getTime() - now.getTime();
  const hoursUntilTrip = msUntilTrip / (60 * 60 * 1000);

  const inLateFeeWindow      = hoursUntilTrip < T_MINUS_72_HOURS;
  const inNoPayCancelWindow  = hoursUntilTrip < T_MINUS_12_HOURS;
  const shouldAccrue         = inLateFeeWindow && !alreadyAssessed;

  return {
    inLateFeeWindow,
    inNoPayCancelWindow,
    hoursUntilTrip,
    shouldAccrue,
    lateFeePaise: LATE_FEE_PAISE,
  };
}
