/* eslint-disable import/first */

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockOrder = jest.fn();
const mockFrom = jest.fn();

const queryBuilder = {
  select: (...args: unknown[]) => {
    mockSelect(...args);
    return queryBuilder;
  },
  eq: (...args: unknown[]) => {
    mockEq(...args);
    return queryBuilder;
  },
  in: (...args: unknown[]) => {
    mockIn(...args);
    return queryBuilder;
  },
  order: (...args: unknown[]) => mockOrder(...args),
};

jest.mock("../../supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return queryBuilder;
    },
  },
}));

import { fetchPendingRequests } from "../bookings";

function bookingRow(id: string, status: string) {
  return {
    id,
    traveler_id: "traveler-1",
    guide_id: "guide-1",
    itinerary_id: null,
    arrival_flight_number: null,
    arrival_time: null,
    departure_time: null,
    tour_start_time: null,
    tour_end_time: null,
    num_travelers: 1,
    buddy_cost: 0,
    estimated_expenses: 0,
    total_amount: 0,
    platform_fee: 0,
    status,
    payment_id: null,
    payment_status: "pending",
    created_at: "2026-07-29T00:00:00.000Z",
  };
}

describe("fetchPendingRequests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrder.mockResolvedValue({
      data: [
        bookingRow("open-request", "chat_open"),
        // Deliberately return a broader mock response to enforce the function's
        // public contract in addition to checking the PostgREST filter.
        bookingRow("agreement-in-flight", "agreement_sent"),
      ],
      error: null,
    });
  });

  it("queries and returns only actionable chat_open inquiries", async () => {
    const requests = await fetchPendingRequests("guide-1");

    expect(mockFrom).toHaveBeenCalledWith("bookings");
    expect(mockEq).toHaveBeenNthCalledWith(1, "guide_id", "guide-1");
    expect(mockEq).toHaveBeenNthCalledWith(2, "status", "chat_open");
    expect(mockIn).not.toHaveBeenCalled();
    expect(requests.map((booking) => booking.id)).toEqual(["open-request"]);
    expect(requests.every((booking) => booking.status === "chat_open")).toBe(
      true,
    );
  });

  it("propagates query errors instead of presenting an empty inbox", async () => {
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: new Error("requests unavailable"),
    });

    await expect(fetchPendingRequests("guide-1")).rejects.toThrow(
      "requests unavailable",
    );
  });
});
