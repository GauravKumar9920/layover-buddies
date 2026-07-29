import { supabase } from "../supabase";
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
