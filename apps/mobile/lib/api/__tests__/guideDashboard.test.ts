/* eslint-disable import/first */

const mockRpc = jest.fn();

jest.mock("../../supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { fetchMyGuideDashboardSummary } from "../guideDashboard";

describe("fetchMyGuideDashboardSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls the auth-keyed RPC without a user id and maps its row to camelCase", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          open_inquiries_count: 3,
          upcoming_trips_count: 4,
          completed_trips_count: 9,
          average_rating: "4.67",
          review_count: 6,
          paid_earnings_paise: 125000,
          paid_earnings_current_month_paise: 42000,
          active_tours_count: 2,
          profile_completion_percent: 86,
          profile_missing_fields: ["profile cover"],
          profile_status: "draft",
          is_published: false,
          is_active: false,
        },
      ],
      error: null,
    });

    await expect(fetchMyGuideDashboardSummary()).resolves.toEqual({
      openInquiries: 3,
      upcomingTrips: 4,
      completedTrips: 9,
      averageRating: 4.67,
      reviewCount: 6,
      paidEarningsTotalPaise: 125000,
      paidEarningsMonthPaise: 42000,
      activeTours: 2,
      profileCompletionPercent: 86,
      profileMissingFields: ["profile cover"],
      profileStatus: "draft",
      profilePublished: false,
      acceptingInquiries: false,
    });
    expect(mockRpc).toHaveBeenCalledWith("get_my_guide_dashboard_summary");
  });

  it("throws the Supabase error unchanged", async () => {
    const rpcError = {
      message: "active_guide_account_required",
      code: "42501",
    };
    mockRpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(fetchMyGuideDashboardSummary()).rejects.toBe(rpcError);
  });

  it("shows a new guide without a fake zero-star rating or open draft profile", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          open_inquiries_count: 0,
          upcoming_trips_count: 0,
          completed_trips_count: 0,
          average_rating: "0",
          review_count: 0,
          paid_earnings_paise: 0,
          paid_earnings_current_month_paise: 0,
          active_tours_count: 0,
          profile_completion_percent: 43,
          profile_missing_fields: ["bio"],
          profile_status: "draft",
          is_published: false,
          is_active: true,
        },
      ],
      error: null,
    });

    await expect(fetchMyGuideDashboardSummary()).resolves.toMatchObject({
      averageRating: null,
      reviewCount: 0,
      profilePublished: false,
      acceptingInquiries: false,
    });
  });

  it("rejects an empty successful response instead of fabricating metrics", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await expect(fetchMyGuideDashboardSummary()).rejects.toThrow(
      "Guide dashboard summary unavailable",
    );
  });
});
