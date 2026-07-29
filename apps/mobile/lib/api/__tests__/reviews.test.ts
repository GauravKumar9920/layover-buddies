/* eslint-disable import/first */

const mockGetUser = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();

jest.mock("../../supabase", () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        insert: (...insertArgs: unknown[]) => mockInsert(...insertArgs),
      };
    },
  },
}));

import { submitReview } from "../reviews";

describe("submitReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "traveler-1" } },
    });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("only inserts the raw review and leaves metrics/state to the database trigger", async () => {
    await submitReview({
      booking_id: "booking-1",
      reviewee_id: "guide-1",
      rating: 5,
      comment: "A thoughtful and memorable Detour.",
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("reviews");
    expect(mockInsert).toHaveBeenCalledWith({
      booking_id: "booking-1",
      reviewer_id: "traveler-1",
      reviewee_id: "guide-1",
      overall_rating: 5,
      comment: "A thoughtful and memorable Detour.",
    });
  });

  it("propagates insert failures", async () => {
    mockInsert.mockResolvedValueOnce({
      error: new Error("review insert failed"),
    });

    await expect(
      submitReview({
        booking_id: "booking-1",
        reviewee_id: "guide-1",
        rating: 4,
      }),
    ).rejects.toThrow("review insert failed");
  });
});
