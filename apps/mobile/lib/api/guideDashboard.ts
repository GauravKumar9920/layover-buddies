import { supabase } from "@/lib/supabase";
import { fetchGuideBookings } from "@/lib/api/bookings";
import {
  buildGuideInsights,
  type GuideInsights,
  type GuideProfileSignals,
  type GuideTourSignal,
} from "@/lib/guide/metrics";
import type { Booking } from "@/types";

export interface GuideDashboardData {
  userId: string;
  firstName: string;
  bookings: Booking[];
  insights: GuideInsights;
  profile: GuideProfileSignals;
  tours: GuideTourSignal[];
}

export async function fetchGuideDashboardData(
  guideUserId: string,
  now = new Date(),
): Promise<GuideDashboardData> {
  const [bookings, userResult, profileResult, toursResult] = await Promise.all([
    fetchGuideBookings(guideUserId),
    supabase
      .from("users")
      .select("full_name")
      .eq("id", guideUserId)
      .maybeSingle(),
    supabase
      .from("guide_profiles")
      .select(
        "avg_rating, total_reviews, response_time_minutes, profile_status, is_active",
      )
      .eq("user_id", guideUserId)
      .maybeSingle(),
    supabase
      .from("itineraries")
      .select("id, title, is_published")
      .eq("guide_id", guideUserId)
      .is("deleted_at", null),
  ]);

  if (userResult.error) throw userResult.error;
  if (profileResult.error) throw profileResult.error;
  if (toursResult.error) throw toursResult.error;

  const profile: GuideProfileSignals = {
    avgRating: Number(profileResult.data?.avg_rating ?? 0),
    totalReviews: Number(profileResult.data?.total_reviews ?? 0),
    responseTimeMinutes:
      Number(profileResult.data?.response_time_minutes ?? 0) > 0
        ? Number(profileResult.data?.response_time_minutes)
        : null,
    profileStatus:
      profileResult.data?.profile_status === "published" ? "published" : "draft",
    acceptingInquiries: profileResult.data?.is_active ?? false,
  };
  const tours: GuideTourSignal[] = (toursResult.data ?? []).map((tour) => ({
    id: tour.id,
    title: tour.title ?? "Mumbai experience",
    published: tour.is_published ?? false,
  }));
  const fullName = userResult.data?.full_name?.trim() || "Guide";

  return {
    userId: guideUserId,
    firstName: fullName.split(/\s+/)[0],
    bookings,
    profile,
    tours,
    insights: buildGuideInsights(bookings, profile, tours, now),
  };
}
