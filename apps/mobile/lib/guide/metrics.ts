import { expectedNetPaise } from "@/lib/booking/earnings";
import { stageForState } from "@/lib/booking/tripStages";
import type { Booking } from "@/types";

export interface GuideProfileSignals {
  avgRating: number;
  totalReviews: number;
  responseTimeMinutes: number | null;
  profileStatus: "draft" | "published";
  acceptingInquiries: boolean;
}

export interface GuideTourSignal {
  id: string;
  title: string;
  published: boolean;
}

export interface GuideOpportunity {
  id: "publish_profile" | "open_inquiries" | "create_tour" | "reply_faster" | "earn_reviews";
  title: string;
  detail: string;
  route: string;
}

export interface GuideInsights {
  thisMonth: {
    inquiries: number;
    completedTrips: number;
    travelersHosted: number;
    earnedPaise: number;
  };
  allTime: {
    completedTrips: number;
    travelersHosted: number;
    repeatTravelers: number;
    earnedPaise: number;
  };
  performance: {
    conversionRate: number | null;
    conversionSample: number;
    guideCancellationRate: number | null;
    cancellationSample: number;
    avgRating: number;
    totalReviews: number;
    responseTimeMinutes: number | null;
  };
  pipeline: {
    openInquiries: number;
    upcomingTrips: number;
  };
  tours: {
    total: number;
    published: number;
    topTour: { id: string; title: string; completedTrips: number } | null;
  };
  opportunities: GuideOpportunity[];
}

const COMPLETED_STATES = new Set<Booking["status"]>(["completed", "rated"]);
const EARLY_OPEN_STATES = new Set<Booking["status"]>([
  "chat_open",
  "agreement_drafting",
  "agreement_sent",
  "agreement_signed_traveler",
  "agreement_signed_buddy",
  "pending",
]);
const EARLY_LOSS_STATES = new Set<Booking["status"]>([
  "cancelled_pre_signing",
  "cancelled_no_deposit",
]);

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const IST_OFFSET_MINUTES = 5 * 60 + 30;

function istYearMonth(date: Date): { year: number; month: number } {
  const inIst = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  return { year: inIst.getUTCFullYear(), month: inIst.getUTCMonth() };
}

function isInIstMonth(value: string, year: number, month: number): boolean {
  const date = validDate(value);
  if (!date) return false;
  const valueMonth = istYearMonth(date);
  return valueMonth.year === year && valueMonth.month === month;
}

function reachedCommitment(booking: Booking): boolean {
  if (COMPLETED_STATES.has(booking.status)) return true;
  const stage = stageForState(booking.status);
  if (stage.status === "active") return stage.index >= 2;
  return (
    booking.status === "cancelled_no_pay" ||
    booking.status === "cancelled_traveler_voluntary" ||
    booking.status === "cancelled_buddy" ||
    booking.status === "cancelled_force_majeure"
  );
}

function roundedRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export function buildGuideInsights(
  bookings: Booking[],
  profile: GuideProfileSignals,
  tours: GuideTourSignal[],
  now = new Date(),
): GuideInsights {
  const completed = bookings.filter((booking) =>
    COMPLETED_STATES.has(booking.status),
  );
  const { year: currentYear, month: currentMonth } = istYearMonth(now);
  const completedThisMonth = completed.filter((booking) =>
    isInIstMonth(booking.start_date, currentYear, currentMonth),
  );
  const inquiriesThisMonth = bookings.filter((booking) =>
    isInIstMonth(booking.created_at, currentYear, currentMonth),
  );

  const completedByTraveler = new Map<string, number>();
  const completedByTour = new Map<string, number>();
  for (const booking of completed) {
    completedByTraveler.set(
      booking.traveler_id,
      (completedByTraveler.get(booking.traveler_id) ?? 0) + 1,
    );
    if (booking.itinerary_id) {
      completedByTour.set(
        booking.itinerary_id,
        (completedByTour.get(booking.itinerary_id) ?? 0) + 1,
      );
    }
  }

  const resolvedForConversion = bookings.filter(
    (booking) => reachedCommitment(booking) || EARLY_LOSS_STATES.has(booking.status),
  );
  const committed = resolvedForConversion.filter(reachedCommitment).length;

  const guideControlledOutcomes = bookings.filter(
    (booking) =>
      COMPLETED_STATES.has(booking.status) || booking.status === "cancelled_buddy",
  );
  const guideCancellations = guideControlledOutcomes.filter(
    (booking) => booking.status === "cancelled_buddy",
  ).length;

  const topTourEntry = [...completedByTour.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];
  const topTour = topTourEntry
    ? {
        id: topTourEntry[0],
        title:
          tours.find((tour) => tour.id === topTourEntry[0])?.title ??
          completed.find((booking) => booking.itinerary_id === topTourEntry[0])
            ?.itinerary?.name ??
          "Custom Detour",
        completedTrips: topTourEntry[1],
      }
    : null;

  const opportunities: GuideOpportunity[] = [];
  if (profile.profileStatus !== "published") {
    opportunities.push({
      id: "publish_profile",
      title: "Publish your profile",
      detail: "Finish your story and photos so travelers can discover you.",
      route: "/(guide)/profile/edit",
    });
  } else if (!profile.acceptingInquiries) {
    opportunities.push({
      id: "open_inquiries",
      title: "Open new inquiries",
      detail: "Your profile is live, but travelers cannot start a new conversation.",
      route: "/(guide)/profile/edit",
    });
  }
  if (tours.filter((tour) => tour.published).length === 0) {
    opportunities.push({
      id: "create_tour",
      title: "Create your first experience",
      detail: "Give travelers a concrete route to ask you about.",
      route: "/(guide)/itineraries/create",
    });
  }
  if (
    profile.responseTimeMinutes !== null &&
    profile.responseTimeMinutes > 15
  ) {
    opportunities.push({
      id: "reply_faster",
      title: "Aim for replies under 15 minutes",
      detail: "Fast, thoughtful replies keep a layover inquiry moving.",
      route: "/(guide)/requests",
    });
  }
  if (completed.length > profile.totalReviews) {
    opportunities.push({
      id: "earn_reviews",
      title: "Turn completed trips into reviews",
      detail: "A quick follow-up helps future travelers trust your experience.",
      route: "/(guide)/messages",
    });
  }

  return {
    thisMonth: {
      inquiries: inquiriesThisMonth.length,
      completedTrips: completedThisMonth.length,
      travelersHosted: completedThisMonth.reduce(
        (sum, booking) => sum + Math.max(1, booking.num_travelers),
        0,
      ),
      earnedPaise: completedThisMonth.reduce(
        (sum, booking) => sum + expectedNetPaise(booking),
        0,
      ),
    },
    allTime: {
      completedTrips: completed.length,
      travelersHosted: completed.reduce(
        (sum, booking) => sum + Math.max(1, booking.num_travelers),
        0,
      ),
      repeatTravelers: [...completedByTraveler.values()].filter(
        (count) => count > 1,
      ).length,
      earnedPaise: completed.reduce(
        (sum, booking) => sum + expectedNetPaise(booking),
        0,
      ),
    },
    performance: {
      conversionRate: roundedRate(committed, resolvedForConversion.length),
      conversionSample: resolvedForConversion.length,
      guideCancellationRate: roundedRate(
        guideCancellations,
        guideControlledOutcomes.length,
      ),
      cancellationSample: guideControlledOutcomes.length,
      avgRating: profile.avgRating,
      totalReviews: profile.totalReviews,
      responseTimeMinutes: profile.responseTimeMinutes,
    },
    pipeline: {
      openInquiries: bookings.filter((booking) =>
        EARLY_OPEN_STATES.has(booking.status),
      ).length,
      upcomingTrips: bookings.filter((booking) => {
        const stage = stageForState(booking.status);
        return stage.status === "active" && stage.index >= 2 && stage.index < 6;
      }).length,
    },
    tours: {
      total: tours.length,
      published: tours.filter((tour) => tour.published).length,
      topTour,
    },
    opportunities: opportunities.slice(0, 3),
  };
}
