/* eslint-disable import/first */

// createBooking derives every trip fact from the traveler's active layover
// instead of accepting them as request fields. These tests pin that contract:
// what lands in the INSERT, and what happens when there is no layover.

const mockInsert = jest.fn();
const mockGetUser = jest.fn();

/** Rows returned by `.select(...).eq(...).is(...).single()` on itineraries. */
let itineraryRow: Record<string, unknown> | null = null;
let itineraryError: unknown = null;

const itineraryBuilder = {
  select: () => itineraryBuilder,
  eq: () => itineraryBuilder,
  is: () => itineraryBuilder,
  single: async () => ({ data: itineraryRow, error: itineraryError }),
};

const insertBuilder = (payload: Record<string, unknown>) => ({
  select: () => ({
    single: async () => {
      mockInsert(payload);
      return {
        data: { ...payload, id: "booking-1", created_at: "2026-08-01T00:00:00.000Z" },
        error: null,
      };
    },
  }),
});

jest.mock("../../supabase", () => ({
  supabase: {
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
    from: (table: string) => {
      if (table === "itineraries") return itineraryBuilder;
      return { insert: (payload: Record<string, unknown>) => insertBuilder(payload) };
    },
  },
}));

const mockFetchProfile = jest.fn();
jest.mock("@/lib/api/travelerProfile", () => ({
  fetchMyTravelerProfile: (...a: unknown[]) => mockFetchProfile(...a),
}));

jest.mock("@/lib/api/platformSettings", () => ({
  getEffectiveRates: async () => ({
    earlyAccessMode: false,
    platformFeeUpRate: 0.125,
    platformFeeDownRate: 0.125,
    commissionRate: 0.25,
    gstRate: 0.05,
    tdsRate: 0.01,
    lateFeePaise: 100000,
  }),
}));

import { createBooking } from "../bookings";

const ARRIVAL = "2026-12-01T00:00:00.000Z";
const DEPARTURE = "2026-12-01T12:00:00.000Z"; // 12h window

function layover(over: Record<string, unknown> = {}) {
  return {
    active_layover_id: "layover-1",
    arrival_at: ARRIVAL,
    departure_at: DEPARTURE,
    flight_in: "EK504",
    flight_out: "AI191",
    group_size: 2,
    party_type: "couple",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  itineraryError = null;
  itineraryRow = { base_cost: 500, buddy_cost: 1200, duration_hours: 3 };
  mockGetUser.mockResolvedValue({ data: { user: { id: "traveler-1" } } });
  mockFetchProfile.mockResolvedValue(layover());
});

describe("createBooking — trip facts come from the layover", () => {
  it("snapshots flights, times and party size off the active layover", async () => {
    await createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" });

    const payload = mockInsert.mock.calls[0][0];
    expect(payload.arrival_flight_number).toBe("EK504");
    // departure_flight_number was declared in the schema and never written
    // until now.
    expect(payload.departure_flight_number).toBe("AI191");
    // Passed through verbatim — these are already true-UTC instants, so any
    // re-parsing here is a chance to drift by the 5.5h IST offset.
    expect(payload.arrival_time).toBe(ARRIVAL);
    expect(payload.departure_time).toBe(DEPARTURE);
    expect(payload.num_travelers).toBe(2);
  });

  it("populates available_window_minutes, which was dead in the schema", () => {
    return createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" }).then(() => {
      expect(mockInsert.mock.calls[0][0].available_window_minutes).toBe(720);
    });
  });

  it("sets the tour window from the shared layover plan, not 09:00–17:00", async () => {
    await createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" });
    const payload = mockInsert.mock.calls[0][0];
    // arrival + 90 transit + 30 buffer = +2h, then a 3h tour.
    expect(payload.tour_start_time).toBe("2026-12-01T02:00:00.000Z");
    expect(payload.tour_end_time).toBe("2026-12-01T05:00:00.000Z");
  });

  it("starts every booking as an inquiry", async () => {
    await createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" });
    expect(mockInsert.mock.calls[0][0].status).toBe("chat_open");
    expect(mockInsert.mock.calls[0][0].payment_status).toBe("pending");
  });

  it("refuses to create a booking with no active layover", async () => {
    mockFetchProfile.mockResolvedValue(null);
    await expect(
      createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" }),
    ).rejects.toThrow(/layover/i);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("refuses when the layover exists but has no times", async () => {
    mockFetchProfile.mockResolvedValue(layover({ arrival_at: null }));
    await expect(
      createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" }),
    ).rejects.toThrow(/layover/i);
  });

  it("clamps an out-of-range party size rather than sending a 23514", async () => {
    mockFetchProfile.mockResolvedValue(layover({ group_size: 9 }));
    await createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" });
    expect(mockInsert.mock.calls[0][0].num_travelers).toBe(4);
  });
});

describe("createBooking — pricing", () => {
  it("charges base once and per-person per head", async () => {
    await createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" });
    const p = mockInsert.mock.calls[0][0];
    expect(p.buddy_cost).toBe(2900); // 500 + 1200 * 2
    expect(p.estimated_expenses).toBe(720); // round(1200 * 0.30) * 2
    expect(p.platform_fee).toBe(725); // 25% of the whole 2900 fee
    expect(p.total_amount).toBe(2900 + 720 + 725);
  });

  // The migration defaults every pre-existing itinerary to base_cost = 0, so
  // legacy tours must price exactly as they did before this change.
  it("reduces to the legacy perPerson × N when base is 0", async () => {
    itineraryRow = { base_cost: 0, buddy_cost: 1200, duration_hours: 3 };
    await createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" });
    expect(mockInsert.mock.calls[0][0].buddy_cost).toBe(2400);
  });

  it("supports a flat-fee tour that does not scale with the party", async () => {
    itineraryRow = { base_cost: 2000, buddy_cost: 0, duration_hours: 3 };
    await createBooking({ guide_id: "guide-1", itinerary_id: "itin-1" });
    expect(mockInsert.mock.calls[0][0].buddy_cost).toBe(2000);
  });

  it("prices a casual inquiry at zero and leaves the tour window open", async () => {
    await createBooking({ guide_id: "guide-1" });
    const p = mockInsert.mock.calls[0][0];
    expect(p.buddy_cost).toBe(0);
    expect(p.total_amount).toBe(0);
    expect(p.itinerary_id).toBeNull();
    // No tour chosen means no defensible tour window — null, not a fiction.
    expect(p.tour_start_time).toBeNull();
    expect(p.tour_end_time).toBeNull();
    // The layover facts still get recorded.
    expect(p.arrival_time).toBe(ARRIVAL);
  });

  it("fails loudly when the itinerary is missing or soft-deleted", async () => {
    itineraryRow = null;
    await expect(
      createBooking({ guide_id: "guide-1", itinerary_id: "gone" }),
    ).rejects.toThrow(/itinerary not found/i);
  });
});
