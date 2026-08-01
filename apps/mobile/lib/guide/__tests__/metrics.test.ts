import { buildGuideInsights, type GuideProfileSignals } from "../metrics";
import type { Booking } from "@/types";

const DEFAULT_PROFILE: GuideProfileSignals = {
  avgRating: 4.8,
  totalReviews: 2,
  responseTimeMinutes: 8,
  profileStatus: "published",
  acceptingInquiries: true,
};

function booking(
  id: string,
  status: Booking["status"],
  overrides: Partial<Booking> = {},
): Booking {
  return {
    id,
    traveler_id: `traveler-${id}`,
    guide_id: "guide-1",
    itinerary_id: "tour-1",
    flight_number: null,
    flight_date: null,
    start_date: "2026-08-12T04:30:00.000Z",
    end_date: "2026-08-12T07:30:00.000Z",
    num_travelers: 1,
    buddy_cost: 1000,
    estimated_expenses: 300,
    total_price: 1300,
    commission: 0,
    status,
    payment_intent_id: null,
    payment_status: "pending",
    created_at: "2026-08-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("buildGuideInsights", () => {
  it("calculates honest monthly and all-time hosting metrics", () => {
    const result = buildGuideInsights(
      [
        booking("one", "completed", { num_travelers: 2 }),
        booking("two", "rated", {
          traveler_id: "traveler-one",
          num_travelers: 1,
          start_date: "2026-07-20T04:30:00.000Z",
          created_at: "2026-07-01T08:00:00.000Z",
        }),
        booking("open", "chat_open"),
      ],
      DEFAULT_PROFILE,
      [{ id: "tour-1", title: "Food Sprint", published: true }],
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(result.thisMonth).toEqual({
      inquiries: 2,
      completedTrips: 1,
      travelersHosted: 2,
      earnedPaise: 100_000,
    });
    expect(result.allTime).toEqual({
      completedTrips: 2,
      travelersHosted: 3,
      repeatTravelers: 1,
      earnedPaise: 200_000,
    });
    expect(result.tours.topTour).toEqual({
      id: "tour-1",
      title: "Food Sprint",
      completedTrips: 2,
    });
  });

  it("measures conversion only after an inquiry has a resolved outcome", () => {
    const result = buildGuideInsights(
      [
        booking("converted", "awaiting_deposits"),
        booking("lost", "cancelled_pre_signing"),
        booking("still-open", "agreement_sent"),
      ],
      DEFAULT_PROFILE,
      [],
    );

    expect(result.performance.conversionSample).toBe(2);
    expect(result.performance.conversionRate).toBe(50);
    expect(result.pipeline.openInquiries).toBe(1);
    expect(result.pipeline.upcomingTrips).toBe(1);
  });

  it("keeps guide cancellation accountability separate from traveler cancellations", () => {
    const result = buildGuideInsights(
      [
        booking("done", "completed"),
        booking("guide-cancel", "cancelled_buddy"),
        booking("traveler-cancel", "cancelled_traveler_voluntary"),
      ],
      DEFAULT_PROFILE,
      [],
    );

    expect(result.performance.cancellationSample).toBe(2);
    expect(result.performance.guideCancellationRate).toBe(50);
  });

  it("returns focused next moves without fabricating unavailable analytics", () => {
    const result = buildGuideInsights(
      [booking("done", "completed")],
      {
        ...DEFAULT_PROFILE,
        totalReviews: 0,
        responseTimeMinutes: 25,
        profileStatus: "draft",
        acceptingInquiries: false,
      },
      [],
    );

    expect(result.opportunities.map((item) => item.id)).toEqual([
      "publish_profile",
      "create_tour",
      "reply_faster",
    ]);
    expect(result.performance.conversionRate).toBe(100);
    expect(result.performance.avgRating).toBe(4.8);
  });

  it("uses null for rates with no meaningful sample", () => {
    const result = buildGuideInsights(
      [booking("open", "chat_open")],
      DEFAULT_PROFILE,
      [],
    );

    expect(result.performance.conversionRate).toBeNull();
    expect(result.performance.guideCancellationRate).toBeNull();
  });

  it("uses Mumbai time for month boundaries", () => {
    const result = buildGuideInsights(
      [
        booking("ist-august", "completed", {
          start_date: "2026-07-31T19:00:00.000Z",
          created_at: "2026-07-31T19:00:00.000Z",
        }),
      ],
      DEFAULT_PROFILE,
      [],
      new Date("2026-07-31T20:00:00.000Z"),
    );

    expect(result.thisMonth.completedTrips).toBe(1);
    expect(result.thisMonth.inquiries).toBe(1);
  });
});
