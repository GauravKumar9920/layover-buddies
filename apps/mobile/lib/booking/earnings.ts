import { PLATFORM_FEE_DOWN_RATE, TDS_RATE } from "@/config/constants";
import { rupeesToPaise } from "@/lib/booking/money";
import type { Booking } from "@/types";

/**
 * A guide's expected net earning from one booking, in paise. This mirrors the
 * reconciliation calculation (platform-down, then TDS) on the buddy fee only;
 * the traveler's expense pot is never counted as guide income. Early-access
 * bookings carry zero commission, so the student keeps the full buddy fee.
 */
export function expectedNetPaise(
  booking: Pick<Booking, "buddy_cost" | "commission">,
): number {
  const buddyFeePaise = rupeesToPaise(booking.buddy_cost);
  if (booking.commission <= 0) return buddyFeePaise;
  const afterPlatform = Math.floor(
    buddyFeePaise * (1 - PLATFORM_FEE_DOWN_RATE),
  );
  return afterPlatform - Math.round(afterPlatform * TDS_RATE);
}
