/* eslint-disable import/first */

jest.mock("../../supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("../bookings", () => ({
  fetchGuideBookings: jest.fn(),
}));

import { expectedNetPaise } from "../earnings";
import { formatPaise } from "../../booking/money";

describe("expectedNetPaise", () => {
  it("bases guide earnings on the buddy fee and excludes the traveler expense pot", () => {
    const compactBooking = {
      buddy_cost: 2_000,
      commission: 250,
      total_price: 2_250,
    };
    const bookingWithExpensePot = {
      ...compactBooking,
      total_price: 6_642.5,
    };

    expect(expectedNetPaise(compactBooking)).toBe(173_250);
    expect(expectedNetPaise(bookingWithExpensePot)).toBe(173_250);
    expect(formatPaise(expectedNetPaise(bookingWithExpensePot))).toBe(
      "₹1,732.50",
    );
  });

  it("returns the full buddy fee for early-access bookings", () => {
    expect(
      expectedNetPaise({
        buddy_cost: 2_000,
        commission: 0,
      }),
    ).toBe(200_000);
  });
});
