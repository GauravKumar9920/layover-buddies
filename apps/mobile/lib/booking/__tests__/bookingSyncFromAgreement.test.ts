// ============================================================================
// bookingFieldsFromAgreement — booking display fields mirror the agreement
// ============================================================================
// Regression for the 2026-06-11 E2E finding: after an agreement was sent,
// trip-detail still showed the inquiry-time estimate (₹7,905 with the legacy
// 25% commission baked in, dated Jun 10) while the agreement said ₹9,560 /
// Jun 15. These tests pin the mapping that sendAgreement now writes.
// ============================================================================

import { bookingFieldsFromAgreement } from '../bookingSyncFromAgreement';

describe('bookingFieldsFromAgreement', () => {
  test('early access (zero rates): booking total equals the agreement total', () => {
    const fields = bookingFieldsFromAgreement({
      buddy_fee_paise:      510_000,  // ₹5,100 (₹1,700 × 3 travelers)
      itinerary_fund_paise: 330_000,  // ₹3,300
      buffer_paise:         66_000,   // ₹660
      platform_fee_up_rate: 0,
      traveler_gst_paise:   0,
      traveler_total_paise: 956_000,  // ₹9,560 incl. ₹500 deposit
      trip_starts_at:       '2026-06-15T10:00:00+00:00',
      trip_ends_at:         '2026-06-15T16:30:00+00:00',
    });

    expect(fields).toEqual({
      buddy_cost: 5_100,
      estimated_expenses: 3_960,   // fund + buffer
      platform_fee: 0,             // early access — nothing added
      gst_amount: 0,
      total_amount: 9_560,         // exactly the agreement screen's Total
      tour_start_time: '2026-06-15T10:00:00+00:00',
      tour_end_time: '2026-06-15T16:30:00+00:00',
    });
  });

  test('standard rates: platform fee is the traveler-side markup only', () => {
    // Canonical §2 worked example: ₹2,000 fee, ₹3,000 fund, ₹600 buffer,
    // 12.5% up, 5% GST → subtotal ₹5,850, GST ₹292.50, total ₹6,642.50.
    const fields = bookingFieldsFromAgreement({
      buddy_fee_paise:      200_000,
      itinerary_fund_paise: 300_000,
      buffer_paise:         60_000,
      platform_fee_up_rate: 0.125,
      traveler_gst_paise:   29_250,
      traveler_total_paise: 664_250,
      trip_starts_at:       '2026-07-01T09:00:00+00:00',
      trip_ends_at:         null,
    });

    expect(fields.buddy_cost).toBe(2_000);
    expect(fields.estimated_expenses).toBe(3_600);
    expect(fields.platform_fee).toBe(250);      // round(200000 × 1.125) − 200000 = ₹250
    expect(fields.gst_amount).toBe(292.5);
    expect(fields.total_amount).toBe(6_642.5);
    expect(fields.tour_end_time).toBeNull();
  });

  test('date fields come from the agreement, not the inquiry', () => {
    const fields = bookingFieldsFromAgreement({
      buddy_fee_paise: 100_000, itinerary_fund_paise: 50_000, buffer_paise: 10_000,
      platform_fee_up_rate: 0, traveler_gst_paise: 0, traveler_total_paise: 210_000,
      trip_starts_at: '2026-08-20T05:00:00+00:00', trip_ends_at: '2026-08-20T12:00:00+00:00',
    });
    expect(fields.tour_start_time).toBe('2026-08-20T05:00:00+00:00');
    expect(fields.tour_end_time).toBe('2026-08-20T12:00:00+00:00');
  });
});
