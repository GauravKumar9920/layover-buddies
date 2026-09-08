import { supabase } from "../supabase";
import { fetchMyTravelerProfile } from "@/lib/api/travelerProfile";
import { computeLayoverPlan } from "@/lib/booking/timeFit";
import { tourBuddyFeeInr, clampPartySize } from "@/lib/booking/tourPricing";
import { minutesBetweenIso } from "@/lib/time/ist";
import {
  COMMISSION_RATE,
  BOOKING_STATUS,
  ESTIMATED_EXPENSES_PERCENT,
} from "@/config/constants";
import { getEffectiveRates } from "./platformSettings";
import type {
  Booking,
  CreateBookingRequest,
  BookingStatus,
  PaymentStatus,
  TravelerSafetyDetails,
} from "@/types";

interface RawUserJoin {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface RawTravelerProfileJoin {
  nationality: string | null;
  interests?: string[] | null;
  about_me?: string | null;
  travel_pace?: string | null;
  dietary_preferences?: string[] | null;
  accessibility_notes?: string | null;
}

interface RawTravelerJoin extends RawUserJoin {
  // PostgREST may embed as a single object (1:1 via UNIQUE FK) or array — handle both.
  traveler_profile?: RawTravelerProfileJoin | RawTravelerProfileJoin[] | null;
}

interface RawTravelerSafetyRow {
  gender: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface RawItineraryStopRow {
  id: string;
  itinerary_id: string;
  stop_order: number | null;
  name: string | null;
  description: string | null;
  estimated_duration_minutes: number | null;
  image_url?: string | null;
}

interface RawItineraryRow {
  id: string;
  guide_id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
  duration_hours: number | null;
  base_cost: number | null;
  buddy_cost: number | null;
  max_travelers: number | null;
  is_published: boolean | null;
  created_at: string;
  stops?: RawItineraryStopRow[];
}

interface RawBookingRow {
  id: string;
  traveler_id: string;
  guide_id: string;
  itinerary_id: string | null;
  arrival_flight_number: string | null;
  arrival_time: string | null;
  departure_time?: string | null;
  tour_start_time: string | null;
  tour_end_time: string | null;
  num_travelers: number | null;
  buddy_cost: number | null;
  estimated_expenses: number | null;
  total_amount: number | null;
  platform_fee: number | null;
  status: string;
  payment_id: string | null;
  payment_status: string;
  created_at: string;
  guide?: RawUserJoin;
  traveler?: RawTravelerJoin;
  itinerary?: RawItineraryRow;
}


function normalizePaymentStatus(status: string): PaymentStatus {
  if (status === "paid") return "captured";
  if (
    status === "pending" ||
    status === "authorized" ||
    status === "captured" ||
    status === "released" ||
    status === "failed" ||
    status === "refunded"
  ) {
    return status;
  }
  return "pending";
}

// All booking_status values that are valid in the DB post Phase 1 migration.
// New financial-lifecycle states are passed through as-is; the mobile UI
// falls back gracefully (BookingCard shows a neutral badge for unknown states).
const VALID_BOOKING_STATUSES = new Set<string>([
  // Legacy values (data migrated but enum values still present)
  "pending",
  "guide_accepted",
  "confirmed",
  // Unchanged from original schema
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
  // Phase 1 financial lifecycle states
  "chat_open",
  "agreement_drafting",
  "agreement_sent",
  "agreement_signed_traveler",
  "agreement_signed_buddy",
  "awaiting_deposits",
  "deposits_held",
  "awaiting_balance",
  "late_fee_due",
  "balance_paid",
  "trip_ready",
  "awaiting_proofs",
  "reconciling",
  "rated",
  "cancelled_no_pay",
  "cancelled_traveler_voluntary",
  "cancelled_buddy",
  "cancelled_force_majeure",
  "cancelled_pre_signing",
  "cancelled_no_deposit",
]);

function normalizeBookingStatus(status: string): BookingStatus {
  if (VALID_BOOKING_STATUSES.has(status)) {
    return status as BookingStatus;
  }
  // Unrecognised value from DB — default to chat_open rather than 'pending'
  // so it surfaces as a real (visible) state rather than an orphan.
  return "chat_open" as BookingStatus;
}

function normalizeItinerary(row?: RawItineraryRow): Booking["itinerary"] {
  if (!row) return undefined;

  return {
    id: row.id,
    guide_id: row.guide_id,
    name: row.title ?? "Mumbai Tour",
    title: row.title ?? "Mumbai Tour",
    description: row.description ?? "",
    city: "Mumbai",
    category: row.category,
    image_url: row.cover_image_url ?? null,
    cover_image_url: row.cover_image_url ?? null,
    estimated_duration_hours: Number(row.duration_hours ?? 0),
    base_cost_inr: Number(row.base_cost ?? 0),
    buddy_cost_inr: Number(row.buddy_cost ?? 0),
    max_travelers: Number(row.max_travelers ?? 1),
    is_active: row.is_published ?? false,
    created_at: row.created_at,
    stops: Array.isArray(row.stops)
      ? row.stops.map((stop) => ({
          id: stop.id,
          itinerary_id: stop.itinerary_id,
          order: Number(stop.stop_order ?? 0),
          location: stop.name ?? "Stop",
          description: stop.description ?? "",
          estimated_duration_minutes: Number(
            stop.estimated_duration_minutes ?? 0,
          ),
          image_url: stop.image_url ?? null,
        }))
      : [],
  };
}

function normalizeGuideUser(row?: RawUserJoin): Booking["guide"] {
  if (!row) return undefined;

  return {
    profile_id: row.id,
    id: row.id,
    user_id: row.id,
    name: row.full_name ?? "Guide",
    bio: null,
    avatar_url: row.avatar_url ?? null,
    avg_rating: 0,
    total_reviews: 0,
    total_trips: 0,
    is_active: true,
    profile_status: "published",
    profile_completed_at: null,
    profile_photos: [],
    languages: [],
    hometown: null,
    categories: [],
    created_at: new Date().toISOString(),
  };
}

function normalizeTravelerUser(row?: RawTravelerJoin): Booking["traveler"] {
  if (!row) return undefined;

  const profile = Array.isArray(row.traveler_profile)
    ? (row.traveler_profile[0] ?? null)
    : (row.traveler_profile ?? null);

  return {
    id: row.id,
    user_id: row.id,
    name: row.full_name ?? "Traveler",
    avatar_url: row.avatar_url ?? null,
    nationality: profile?.nationality ?? null,
    interests: profile?.interests ?? null,
    about_me: profile?.about_me ?? null,
    travel_pace:
      profile?.travel_pace === "relaxed" ||
      profile?.travel_pace === "balanced" ||
      profile?.travel_pace === "packed"
        ? profile.travel_pace
        : null,
    dietary_preferences: Array.isArray(profile?.dietary_preferences)
      ? profile.dietary_preferences
      : [],
    accessibility_notes: profile?.accessibility_notes ?? null,
    phone: null,
    created_at: new Date().toISOString(),
  };
}

function normalizeTravelerSafety(
  row: RawTravelerSafetyRow,
): TravelerSafetyDetails {
  const gender = row.gender;
  return {
    gender:
      gender === "female" ||
      gender === "male" ||
      gender === "non_binary" ||
      gender === "prefer_not_to_say"
        ? gender
        : null,
    emergency_contact_name: row.emergency_contact_name ?? null,
    emergency_contact_phone: row.emergency_contact_phone ?? null,
  };
}

function normalizeBooking(row: RawBookingRow): Booking {
  const startDate = row.tour_start_time ?? row.arrival_time ?? row.created_at;
  const endDate = row.tour_end_time ?? startDate;

  return {
    id: row.id,
    traveler_id: row.traveler_id,
    guide_id: row.guide_id,
    itinerary_id: row.itinerary_id ?? "",
    flight_number: row.arrival_flight_number,
    flight_date: row.arrival_time ? row.arrival_time.slice(0, 10) : null,
    start_date: startDate,
    end_date: endDate,
    num_travelers: Number(row.num_travelers ?? 1),
    buddy_cost: Number(row.buddy_cost ?? 0),
    estimated_expenses: Number(row.estimated_expenses ?? 0),
    total_price: Number(row.total_amount ?? 0),
    commission: Number(row.platform_fee ?? 0),
    status: normalizeBookingStatus(row.status),
    payment_intent_id: row.payment_id,
    payment_status: normalizePaymentStatus(row.payment_status),
    created_at: row.created_at,
    arrival_time: row.arrival_time ?? null,
    departure_time: row.departure_time ?? null,
    guide: normalizeGuideUser(row.guide),
    traveler: normalizeTravelerUser(row.traveler),
    itinerary: normalizeItinerary(row.itinerary),
  };
}

/**
 * Estimate-path commission. Pass the effective rate from
 * `getEffectiveRates()` — 0 during early access. Falls back to the
 * legacy constant when no rate is supplied.
 */
export function calcCommission(
  buddyCost: number,
  commissionRate: number = COMMISSION_RATE,
): number {
  return Math.round(buddyCost * commissionRate);
}

export async function createBooking(
  req: CreateBookingRequest,
): Promise<Booking> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  // The traveler's active layover is the single source of truth for when the
  // trip happens and how many people are coming. It was captured once at
  // onboarding and is editable from the profile or the booking screen's
  // "Edit trip details" — never re-asked as part of sending an inquiry.
  const profile = await fetchMyTravelerProfile();
  if (!profile?.active_layover_id || !profile.arrival_at || !profile.departure_at) {
    throw new Error(
      "Add your Mumbai layover before sending an inquiry.",
    );
  }

  // Snapshot, not a reference: a traveler who later edits their layover must
  // not retroactively change what this booking was agreed and priced on.
  const numTravelers = clampPartySize(profile.group_size);
  const availableWindowMinutes = minutesBetweenIso(
    profile.arrival_at,
    profile.departure_at,
  );

  // A casual inquiry has no package yet — pricing is figured out later in the
  // chat/agreement once the itinerary is built. Only fetch + price when a tour
  // was actually selected.
  let buddyCost = 0;
  let estimatedExpenses = 0;
  let commission = 0;
  let tourStartTime: string | null = null;
  let tourEndTime: string | null = null;

  if (req.itinerary_id) {
    // Fetch itinerary to get price (deleted tours can't be booked)
    const { data: itin, error: itinErr } = await supabase
      .from("itineraries")
      .select("base_cost, buddy_cost, duration_hours")
      .eq("id", req.itinerary_id)
      .is("deleted_at", null)
      .single();

    if (itinErr || !itin) throw new Error("Itinerary not found");

    const rates = await getEffectiveRates();

    // Buddy fee is base + per-person × party. Expenses stay strictly
    // per-head — meals and entry tickets scale with people, not with the
    // Buddy's fixed planning effort — while commission is taken on the whole
    // fee, since it is the platform's cut of what the Buddy earns.
    const perPersonBuddyCost = Number(itin.buddy_cost ?? 0);
    buddyCost = tourBuddyFeeInr(
      Number(itin.base_cost ?? 0),
      perPersonBuddyCost,
      numTravelers,
    );
    estimatedExpenses =
      Math.round(perPersonBuddyCost * (ESTIMATED_EXPENSES_PERCENT / 100)) *
      numTravelers;
    commission = calcCommission(buddyCost, rates.commissionRate);

    // The window the traveler was shown on the fit chip is the window the
    // booking records — rather than the old hardcoded 09:00–17:00 fiction.
    const plan = computeLayoverPlan({
      arrivalIso: profile.arrival_at,
      departureIso: profile.departure_at,
      tourHours: Number(itin.duration_hours ?? 0),
    });
    tourStartTime = plan?.tourStart.toISOString() ?? null;
    tourEndTime = plan?.tourEnd.toISOString() ?? null;
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      traveler_id: user.id,
      guide_id: req.guide_id,
      itinerary_id: req.itinerary_id ?? null,
      arrival_flight_number: profile.flight_in,
      departure_flight_number: profile.flight_out,
      // Already true-UTC instants of an IST wall clock, so they go through
      // verbatim — no re-parsing, no second chance to drift by 5.5 hours.
      arrival_time: profile.arrival_at,
      departure_time: profile.departure_at,
      available_window_minutes: availableWindowMinutes,
      tour_start_time: tourStartTime,
      tour_end_time: tourEndTime,
      num_travelers: numTravelers,
      buddy_cost: buddyCost,
      estimated_expenses: estimatedExpenses,
      platform_fee: commission,
      total_amount: buddyCost + estimatedExpenses + commission,
      // Every booking starts as an inquiry (chat_open); the agreement flow
      // turns it into a paid booking later.
      status: "chat_open",
      payment_status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;
  return normalizeBooking(data as RawBookingRow);
}

export async function fetchTravelerBookings(
  travelerId: string,
): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "*, guide:users!guide_id(id, full_name, avatar_url), itinerary:itineraries(*)",
    )
    .eq("traveler_id", travelerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as RawBookingRow[] | null)?.map(normalizeBooking) ?? [];
}

export async function fetchGuideBookings(guideId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "*, traveler:users!traveler_id(id, full_name, avatar_url, traveler_profile:traveler_profiles(nationality, interests, about_me, travel_pace, dietary_preferences, accessibility_notes)), itinerary:itineraries(*)",
    )
    .eq("guide_id", guideId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as RawBookingRow[] | null)?.map(normalizeBooking) ?? [];
}

export async function fetchPendingRequests(
  guideId: string,
): Promise<Booking[]> {
  // A request is actionable only while the inquiry is still open. Once an
  // agreement has been sent it belongs in the booking lifecycle, not the guide's
  // new-request inbox.
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "*, traveler:users!traveler_id(id, full_name, avatar_url, traveler_profile:traveler_profiles(nationality, interests, about_me, travel_pace, dietary_preferences, accessibility_notes)), itinerary:itineraries(*)",
    )
    .eq("guide_id", guideId)
    .eq("status", "chat_open")
    .order("created_at", { ascending: false });

  if (error) throw error;
  // Keep the function's contract strict even if a mock, stale PostgREST cache,
  // or future query refactor returns a broader row set.
  return (
    (data as RawBookingRow[] | null)
      ?.filter((row) => row.status === "chat_open")
      .map(normalizeBooking) ?? []
  );
}

export async function acceptBooking(bookingId: string): Promise<void> {
  // Phase 1: accepting a request means the guide is starting to draft the
  // binding agreement, so we advance to agreement_drafting.
  // BOOKING_STATUS.GUIDE_ACCEPTED is kept in constants for legacy read-compat.
  const { error } = await supabase
    .from("bookings")
    .update({ status: "agreement_drafting" })
    .eq("id", bookingId);

  if (error) throw error;
}

export async function declineBooking(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({
      status: BOOKING_STATUS.CANCELLED_PRE_SIGNING,
      cancelled_by: "guide",
    })
    .eq("id", bookingId);

  if (error) throw error;
}

/**
 * Traveler cancels an inquiry before both signatures land (no money held).
 * Writes cancelled_pre_signing directly — the DB transition trigger permits
 * exactly this move for booking parties. Once deposits exist the cancellation
 * must go through the cancel-booking edge function (lib/api/cancellation.ts),
 * which computes the refund resolution; direct status writes are rejected
 * server-side.
 */
export async function cancelBookingPreSigning(
  bookingId: string,
): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({
      status: BOOKING_STATUS.CANCELLED_PRE_SIGNING,
      cancelled_by: "traveler",
    })
    .eq("id", bookingId);

  if (error) throw error;
}

export async function fetchBookingById(
  bookingId: string,
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "*, guide:users!guide_id(id, full_name, avatar_url), traveler:users!traveler_id(id, full_name, avatar_url, traveler_profile:traveler_profiles(nationality, interests, about_me, travel_pace, dietary_preferences, accessibility_notes)), itinerary:itineraries(*, stops:itinerary_stops(*))",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeBooking(data as RawBookingRow) : null;
}

/**
 * Guide detail fetch with a deliberately separate safety read.
 *
 * We first load the booking and verify both the assigned guide and lifecycle
 * state. Only then do we ask Postgres for private safety data; its RLS policy is
 * the final authority and returns no row when access is not permitted.
 */
export async function fetchGuideBookingById(
  bookingId: string,
): Promise<Booking | null> {
  const booking = await fetchBookingById(bookingId);
  if (!booking) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canRequestSafety =
    user?.id === booking.guide_id &&
    (booking.status === "trip_ready" || booking.status === "in_progress");

  if (!canRequestSafety) return booking;

  const { data, error } = await supabase
    .from("traveler_safety_profiles")
    .select("gender, emergency_contact_name, emergency_contact_phone")
    .eq("traveler_id", booking.traveler_id)
    .maybeSingle();

  if (error) throw error;

  return {
    ...booking,
    traveler_safety: data
      ? normalizeTravelerSafety(data as RawTravelerSafetyRow)
      : null,
  };
}
