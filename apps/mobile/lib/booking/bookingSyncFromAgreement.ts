// ============================================================================
// BOOKING ←AGREEMENT SYNC — keep legacy display fields consistent
// ============================================================================
// The trip-detail screen (and the admin Revenue page) read the bookings
// table's denormalized rupee fields (`total_amount`, `buddy_cost`,
// `platform_fee`, `gst_amount`, `tour_start_time`…), which are written at
// inquiry time from the rough estimate. Once an agreement is SENT, the
// agreement snapshot is the source of truth — if the booking row isn't
// refreshed, the traveler sees two different totals and two different dates
// depending on which screen they open (found live in the 2026-06-11 E2E run:
// trip-detail said ₹7,905 / Jun 10 while the agreement said ₹9,560 / Jun 15).
//
// This helper maps an agreement's canonical paise snapshot onto the booking's
// legacy rupee fields. Pure function — `sendAgreement` applies it in the same
// write that advances the booking status.
// ============================================================================

import { paiseToRupees } from './money';

export interface AgreementForSync {
  buddy_fee_paise: number;
  itinerary_fund_paise: number;
  buffer_paise: number;
  platform_fee_up_rate: number;
  traveler_gst_paise: number;
  traveler_total_paise: number;
  trip_starts_at: string;
  trip_ends_at: string | null;
}

export interface BookingDisplayFields {
  /** Guide's gross fee, rupees. */
  buddy_cost: number;
  /** Day fund + 20% buffer, rupees — everything earmarked for spending. */
  estimated_expenses: number;
  /** Traveler-side platform markup, rupees (0 during early access). */
  platform_fee: number;
  /** GST, rupees (0 during early access). */
  gst_amount: number;
  /** What the traveler pays in total (incl. refundable deposit), rupees —
   *  always equals the agreement screen's "Total". */
  total_amount: number;
  tour_start_time: string;
  tour_end_time: string | null;
}

/** Map a sent agreement's snapshot onto the booking's denormalized fields. */
export function bookingFieldsFromAgreement(a: AgreementForSync): BookingDisplayFields {
  const platformUpPaise = Math.round(a.buddy_fee_paise * (1 + a.platform_fee_up_rate)) - a.buddy_fee_paise;

  return {
    buddy_cost: paiseToRupees(a.buddy_fee_paise),
    estimated_expenses: paiseToRupees(a.itinerary_fund_paise + a.buffer_paise),
    platform_fee: paiseToRupees(platformUpPaise),
    gst_amount: paiseToRupees(a.traveler_gst_paise),
    total_amount: paiseToRupees(a.traveler_total_paise),
    tour_start_time: a.trip_starts_at,
    tour_end_time: a.trip_ends_at,
  };
}
