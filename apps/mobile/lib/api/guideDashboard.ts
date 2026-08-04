import { supabase } from "@/lib/supabase";
import { fetchGuideBookings } from "@/lib/api/bookings";
import {
  buildGuideInsights,
  type GuideInsights,
  type GuideProfileSignals,
  type GuideTourSignal,
} from "@/lib/guide/metrics";
import type { Booking } from "@/types";
import type { Database } from "@/types/supabase";

type GuideDashboardSummaryRow =
  Database["public"]["Functions"]["get_my_guide_dashboard_summary"]["Returns"][number];

export interface GuideDashboardSummary {
  openInquiries: number;
  upcomingTrips: number;
  completedTrips: number;
  averageRating: number | null;
  reviewCount: number;
  paidEarningsTotalPaise: number;
  paidEarningsMonthPaise: number;
  activeTours: number;
  profileCompletionPercent: number;
  profileMissingFields: string[];
  profileStatus: "draft" | "published";
  profilePublished: boolean;
  acceptingInquiries: boolean;
}

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeProfileStatus(
  value: GuideDashboardSummaryRow["profile_status"],
): GuideDashboardSummary["profileStatus"] {
  return value === "published" ? "published" : "draft";
}

function normalizeSummary(
  row: GuideDashboardSummaryRow,
): GuideDashboardSummary {
  const reviewCount = toFiniteNumber(row.review_count);
  const profilePublished = row.is_published === true;
  return {
    openInquiries: toFiniteNumber(row.open_inquiries_count),
    upcomingTrips: toFiniteNumber(row.upcoming_trips_count),
    completedTrips: toFiniteNumber(row.completed_trips_count),
    averageRating: reviewCount > 0 ? toFiniteNumber(row.average_rating) : null,
    reviewCount,
    paidEarningsTotalPaise: toFiniteNumber(row.paid_earnings_paise),
    paidEarningsMonthPaise: toFiniteNumber(
      row.paid_earnings_current_month_paise,
    ),
    activeTours: toFiniteNumber(row.active_tours_count),
    profileCompletionPercent: toFiniteNumber(row.profile_completion_percent),
    profileMissingFields: Array.isArray(row.profile_missing_fields)
      ? row.profile_missing_fields.filter(
          (field): field is string => typeof field === "string",
        )
      : [],
    profileStatus: normalizeProfileStatus(row.profile_status),
    profilePublished,
    // A draft profile is never available to travelers even if a legacy row
    // still carries is_active=true.
    acceptingInquiries: profilePublished && row.is_active === true,
  };
}

/**
 * Fetch the signed-in guide's private cockpit aggregate.
 *
 * Identity is intentionally not accepted as an argument: the Postgres
 * function derives it exclusively from auth.uid().
 */
export async function fetchMyGuideDashboardSummary(): Promise<GuideDashboardSummary> {
  const { data, error } = await supabase.rpc("get_my_guide_dashboard_summary");

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | GuideDashboardSummaryRow
    | null
    | undefined;
  if (!row) {
    throw new Error("Guide dashboard summary unavailable");
  }

  return normalizeSummary(row);
}

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
