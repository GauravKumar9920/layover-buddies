import type { BOOKING_STATUS, PAYMENT_STATUS } from "@/config/constants";
import type { BookingState } from "@/lib/booking/stateMachine";

// ─── Auth ───────────────────────────────────────────────────────────────────

/**
 * Mirrors `public.users` (the table the auth-sync trigger populates from
 * `auth.users` — see migration `20260426_auth_sync.sql`). Most of the time
 * code reads `users.full_name` (via PostgREST JOINs) — the legacy `name`
 * field doesn't exist on the DB and shouldn't be referenced.
 */
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone?: string | null;
  role?: "traveler" | "guide" | "admin" | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
  created_at: string;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

/**
 * App-facing guide profile. NOTE on schema drift vs DB:
 *   - `name` and `avatar_url` are NOT columns on `guide_profiles` directly —
 *     they are JOINed from `public.users.full_name / users.avatar_url` by
 *     `lib/api/guides.ts → normalizeGuideProfile`. The normalizer falls back
 *     to literal `'Guide'` / `'Traveler'` when the join is empty. Always
 *     populate via the normalizer; don't write these fields back to the
 *     `guide_profiles` table.
 *   - `categories` lives on `guide_profiles` as JSONB and is hydrated into
 *     a string[] by the normalizer. Older review docs said this column
 *     didn't exist — verify when touching schema.
 */
export interface GuideProfile {
  /** Database primary key for guide_profiles. `id` stays aligned to users.id
   *  because bookings and itineraries reference the guide user. */
  profile_id: string;
  id: string;
  user_id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  portfolio_image_url?: string | null;
  /** @deprecated Legacy unordered gallery. New writes use profile_photos. */
  gallery_urls?: string[];
  /** Explicitly placed profile media. Tour and stop media live on itineraries. */
  profile_photos: GuideProfilePhoto[];
  university?: string | null;
  avg_rating: number;
  total_reviews: number;
  total_trips: number;
  is_active: boolean;
  profile_status: "draft" | "published";
  profile_completed_at: string | null;
  languages: string[];
  hometown: string | null;
  categories: string[];
  created_at: string;
  // Editorial-zine profile fields (migration 20260420160000)
  prompts?: GuidePrompt[];
  pull_quote?: string | null;
  /**
   * Cheapest and shortest published tour this guide offers. Derived by the
   * list query, not stored. `shortest_tour_hours` is what makes the layover
   * fit chip on a guide card a real verdict instead of a guess — when it is
   * null the caller must hide the chip rather than assume a duration.
   */
  shortest_tour_hours?: number | null;
  from_price_inr?: number | null;
}

export type GuideProfilePhotoRole = "cover" | "story" | "gallery";

export interface GuideProfilePhoto {
  id: string;
  guide_profile_id: string;
  role: GuideProfilePhotoRole;
  storage_bucket: string | null;
  storage_path: string | null;
  url: string;
  caption: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TravelerProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  nationality: string | null;
  /** Onboarding interests — present only when the query embeds
   *  traveler_profiles(interests) (e.g. the guide requests screen). */
  interests?: string[] | null;
  /** Guide-readable planning context shared once a booking exists. */
  about_me?: string | null;
  travel_pace?: "relaxed" | "balanced" | "packed" | null;
  dietary_preferences?: string[] | null;
  accessibility_notes?: string | null;
  phone: string | null;
  created_at: string;
}

/**
 * Private trip-day details. This must never be folded into TravelerProfile:
 * RLS exposes it to the assigned Buddy only while a booking is trip_ready or
 * in_progress, and the booking API fetches it separately after checking state.
 */
export interface TravelerSafetyDetails {
  gender: "female" | "male" | "non_binary" | "prefer_not_to_say" | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

// ─── Itineraries ─────────────────────────────────────────────────────────────

export interface ItineraryStop {
  id: string;
  itinerary_id: string;
  order: number;
  location: string;
  description: string;
  estimated_duration_minutes: number;
  image_url?: string | null;
}

/**
 * Rich-text building block used by the (legacy) package detail screen
 * (mobile/app/(traveler)/itinerary/[id].tsx). Persisted as JSONB
 * on itineraries.story_blocks via migration 20260420120000.
 *
 * The Hinge-style refactor (migration 20260420160000) moves to
 * `TourPrompt[]` instead, but we keep this type around because
 * legacy rows and the fallback `buildMockStory()` still emit it.
 */
export type StoryBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string; author?: string }
  | { kind: "highlight"; emoji: string; title: string; body: string };

/**
 * Hinge-style prompt — one of the 3 Q/A cards a guide fills in per tour.
 * Persisted as JSONB on itineraries.prompts via migration 20260420160000.
 *
 * The UI interleaves prompt cards between photos on the detail page so
 * the reader scrolls: photo → prompt → photo → prompt → photo → prompt.
 */
export interface TourPrompt {
  question: string;
  answer: string;
}

/**
 * Guide-level prompt, surfaced on the editorial-zine guide profile.
 * Same shape as TourPrompt but scoped to the guide (not a tour).
 * Persisted as JSONB on guide_profiles.prompts via migration 20260420160000.
 */
export interface GuidePrompt {
  question: string;
  answer: string;
}

export interface Itinerary {
  id: string;
  guide_id: string;
  name: string;
  title?: string;
  description: string;
  city: string;
  category?: string | null;
  image_url?: string | null;
  cover_image_url?: string | null;
  estimated_duration_hours: number;
  /** Flat charge applied once per booking, whatever the party size. */
  base_cost_inr: number;
  /** Per-person charge. A party of N pays base_cost_inr + buddy_cost_inr * N. */
  buddy_cost_inr: number;
  max_travelers: number;
  is_active: boolean;
  created_at: string;
  stops?: ItineraryStop[];
  // Story-content fields (migration 20260420120000_itinerary_story_fields.sql)
  story_blocks?: StoryBlock[];
  gallery_urls?: string[];
  video_url?: string | null;
  video_duration_seconds?: number | null;
  // Hinge-style prompts (migration 20260420160000_hinge_prompts_and_favorites.sql)
  prompts?: TourPrompt[];
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus =
  (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];
// Alias so consumers can use either name — BookingState is the comprehensive
// 25-value union from stateMachine.ts; BookingStatus is the legacy 7-value
// subset from BOOKING_STATUS constants.
export type { BookingState };
export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export interface Booking {
  id: string;
  traveler_id: string;
  guide_id: string;
  /**
   * Nullable on the DB side — `bookings.itinerary_id` has
   * `REFERENCES itineraries(id) ON DELETE SET NULL`, so a booking can outlive
   * its (soft-deleted) itinerary. UI code that reads this must handle null.
   */
  itinerary_id: string | null;
  flight_number: string | null;
  flight_date: string | null;
  start_date: string;
  end_date: string;
  /** Group size for this booking — pricing on total_price / commission /
   *  buddy_cost / estimated_expenses has already been multiplied by this.
   *  Surfaced so downstream screens (payment, trip detail, receipts) can
   *  show per-person ✕ count breakdowns without re-deriving from itinerary. */
  num_travelers: number;
  /** Guide compensation locked at booking time (already × num_travelers). */
  buddy_cost: number;
  /** Estimated expenses locked at booking time (already × num_travelers). */
  estimated_expenses: number;
  total_price: number;
  commission: number;
  /** Runtime booking state — the full 25-value union from the Phase 1 state
   *  machine (stateMachine.ts). The legacy `BookingStatus` type covers only
   *  the 7 pre-Phase-1 values; both are kept for backward compatibility. */
  status: BookingState;
  /**
   * Razorpay payment id. The DB column is `bookings.payment_id`; this field
   * is named with the legacy `_intent_` infix for backward compatibility with
   * code written against the pre-Razorpay (Stripe-era) types. The normalizer
   * maps DB `payment_id` → TS `payment_intent_id`.
   */
  payment_intent_id: string | null;
  payment_status: PaymentStatus;
  created_at: string;
  /** Traveler's flight window (bookings.arrival_time / departure_time) —
   *  powers layover-length chips on guide-facing screens. */
  arrival_time?: string | null;
  departure_time?: string | null;
  // Joined fields
  guide?: GuideProfile;
  traveler?: TravelerProfile;
  /** Present only for the assigned guide on a trip_ready/in_progress booking. */
  traveler_safety?: TravelerSafetyDetails | null;
  itinerary?: Itinerary;
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: TravelerProfile | GuideProfile;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ─── API Request/Response ────────────────────────────────────────────────────

/**
 * Everything about *when* the trip happens now comes from the traveler's
 * active layover, which they filled in once at onboarding — so flight number,
 * arrival/departure times and party size are deliberately NOT accepted here.
 * `createBooking` reads them from `traveler_layovers` and snapshots them onto
 * the booking. Asking for them again was the whole problem.
 */
export interface CreateBookingRequest {
  guide_id: string;
  /** Null/omitted for a casual inquiry (no specific package chosen yet). */
  itinerary_id?: string | null;
}

export interface CreateReviewRequest {
  booking_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
}

export interface SendMessageRequest {
  booking_id: string;
  content: string;
}

// ─── UI State ────────────────────────────────────────────────────────────────

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export type UserRole = "traveler" | "guide";
