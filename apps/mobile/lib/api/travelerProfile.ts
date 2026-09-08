// ============================================================================
// TRAVELER PROFILE — identity/preferences + active layover + private safety
// ============================================================================
// The UI consumes one aggregate, but persistence deliberately keeps three
// domains separate:
//   traveler_profiles       stable preferences
//   traveler_layovers       the current/repeatable visit
//   traveler_safety_profiles private emergency information
// ============================================================================

import { supabase } from "../supabase";

/** Mirrors traveler_layovers.party_type's CHECK constraint. */
export type PartyType = "solo" | "couple" | "family" | "friends";
/** Mirrors traveler_profiles.age_band's CHECK constraint. */
export type AgeBand = "18_24" | "25_34" | "35_49" | "50_64" | "65_plus";

export interface TravelerLayover {
  id: string;
  traveler_id: string;
  airport_code: string;
  arrival_at: string;
  departure_at: string;
  flight_in: string | null;
  flight_out: string | null;
  group_size: number;
  party_type: PartyType | null;
  status: "active" | "archived";
}

export interface TravelerProfile {
  user_id: string;
  nationality: string | null;
  preferred_language: string | null;
  interests: string[];
  about_me: string | null;
  travel_pace: "relaxed" | "balanced" | "packed" | null;
  dietary_preferences: string[];
  accessibility_notes: string | null;
  age_band: AgeBand | null;
  onboarding_version: number;
  setup_completed_at: string | null;
  onboarded_at: string | null;

  // Active-layover projection kept flat for existing Explore/booking callers.
  active_layover_id: string | null;
  airport_code: string | null;
  arrival_at: string | null;
  departure_at: string | null;
  flight_in: string | null;
  flight_out: string | null;
  group_size: number;
  party_type: PartyType | null;

  // Private safety projection. RLS permits owner reads and active-trip Buddy reads.
  gender: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export interface OnboardingPayload {
  nationality: string;
  gender?: string | null;
  arrival_at: string;
  departure_at: string;
  flight_in?: string | null;
  flight_out?: string | null;
  interests: string[];
  age_band?: AgeBand | null;
  party_type?: PartyType | null;
  group_size?: number;
}

export interface NextLayoverPayload {
  arrival_at: string;
  departure_at: string;
  flight_in?: string | null;
  flight_out?: string | null;
  group_size: number;
  party_type?: PartyType | null;
  airport_code?: string;
}

const PARTY_TYPES: readonly PartyType[] = [
  "solo",
  "couple",
  "family",
  "friends",
];
const AGE_BANDS: readonly AgeBand[] = [
  "18_24",
  "25_34",
  "35_49",
  "50_64",
  "65_plus",
];

function asPartyType(value: unknown): PartyType | null {
  return typeof value === "string" && (PARTY_TYPES as readonly string[]).includes(value)
    ? (value as PartyType)
    : null;
}

function asAgeBand(value: unknown): AgeBand | null {
  return typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value)
    ? (value as AgeBand)
    : null;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function aggregateTravelerProfile(
  userId: string,
  profile: Record<string, unknown> | null,
  layover: Record<string, unknown> | null,
  safety: Record<string, unknown> | null,
): TravelerProfile | null {
  if (!profile && !layover && !safety) return null;

  const pace = profile?.travel_pace;
  return {
    user_id: userId,
    nationality:
      typeof profile?.nationality === "string" ? profile.nationality : null,
    preferred_language:
      typeof profile?.preferred_language === "string"
        ? profile.preferred_language
        : null,
    interests: normalizeStringArray(profile?.interests),
    about_me: typeof profile?.about_me === "string" ? profile.about_me : null,
    travel_pace:
      pace === "relaxed" || pace === "balanced" || pace === "packed"
        ? pace
        : null,
    dietary_preferences: normalizeStringArray(profile?.dietary_preferences),
    accessibility_notes:
      typeof profile?.accessibility_notes === "string"
        ? profile.accessibility_notes
        : null,
    onboarding_version: Number(profile?.onboarding_version ?? 1),
    setup_completed_at:
      typeof profile?.setup_completed_at === "string"
        ? profile.setup_completed_at
        : null,
    onboarded_at:
      typeof profile?.onboarded_at === "string" ? profile.onboarded_at : null,
    age_band: asAgeBand(profile?.age_band),

    active_layover_id: typeof layover?.id === "string" ? layover.id : null,
    airport_code:
      typeof layover?.airport_code === "string" ? layover.airport_code : null,
    arrival_at:
      typeof layover?.arrival_at === "string" ? layover.arrival_at : null,
    departure_at:
      typeof layover?.departure_at === "string" ? layover.departure_at : null,
    flight_in:
      typeof layover?.flight_in === "string" ? layover.flight_in : null,
    flight_out:
      typeof layover?.flight_out === "string" ? layover.flight_out : null,
    group_size: Number(layover?.group_size ?? 1),
    party_type: asPartyType(layover?.party_type),

    gender: typeof safety?.gender === "string" ? safety.gender : null,
    emergency_contact_name:
      typeof safety?.emergency_contact_name === "string"
        ? safety.emergency_contact_name
        : null,
    emergency_contact_phone:
      typeof safety?.emergency_contact_phone === "string"
        ? safety.emergency_contact_phone
        : null,
  };
}

/** Fetch the signed-in traveler's full builder state. */
export async function fetchMyTravelerProfile(): Promise<TravelerProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileResult, layoverResult, safetyResult] = await Promise.all([
    supabase
      .from("traveler_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("traveler_layovers")
      .select("*")
      .eq("traveler_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("traveler_safety_profiles")
      .select("*")
      .eq("traveler_id", user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (layoverResult.error) throw layoverResult.error;
  if (safetyResult.error) throw safetyResult.error;

  return aggregateTravelerProfile(
    user.id,
    profileResult.data as Record<string, unknown> | null,
    layoverResult.data as Record<string, unknown> | null,
    safetyResult.data as Record<string, unknown> | null,
  );
}

/** Persist onboarding by domain and mark the stable profile as complete. */
export async function completeOnboarding(
  payload: OnboardingPayload,
): Promise<TravelerProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.rpc("complete_traveler_onboarding_tx", {
    p_nationality: payload.nationality,
    p_gender: payload.gender ?? null,
    p_arrival_at: payload.arrival_at,
    p_departure_at: payload.departure_at,
    p_flight_in: payload.flight_in ?? null,
    p_flight_out: payload.flight_out ?? null,
    p_interests: payload.interests,
    p_age_band: payload.age_band ?? null,
    p_party_type: payload.party_type ?? null,
    p_group_size: payload.group_size ?? 1,
  });
  if (error) throw error;

  const saved = await fetchMyTravelerProfile();
  if (!saved) throw new Error("Traveler profile was not created.");
  return saved;
}

/** Fields editable from the structured Profile builder. */
export interface TravelerProfilePatch {
  full_name?: string;
  avatar_url?: string;

  nationality?: string | null;
  preferred_language?: string | null;
  interests?: string[];
  about_me?: string | null;
  travel_pace?: "relaxed" | "balanced" | "packed" | null;
  dietary_preferences?: string[];
  accessibility_notes?: string | null;
  age_band?: AgeBand | null;

  arrival_at?: string;
  departure_at?: string;
  flight_in?: string | null;
  flight_out?: string | null;
  airport_code?: string;
  group_size?: number;
  party_type?: PartyType | null;

  gender?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

/** Persist a partial edit, split along the model's privacy/lifecycle boundaries. */
export async function updateMyTravelerProfile(
  patch: TravelerProfilePatch,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const serializablePatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
  const { error } = await supabase.rpc("save_my_traveler_profile_tx", {
    p_patch: serializablePatch,
  });
  if (error) throw error;
}

/** The trip facts editable from the booking screen's "Edit trip details". */
export interface ActiveLayoverPatch {
  arrival_at?: string;
  departure_at?: string;
  flight_in?: string | null;
  flight_out?: string | null;
  group_size?: number;
  party_type?: PartyType | null;
}

/**
 * Patch the traveler's CURRENT layover in place.
 *
 * Deliberately not `createMyNextLayover`: that archives the active row and
 * mints a new one, which is right for "I'm coming back in March" and wrong for
 * "I typed my flight number wrong". Correcting a typo must not orphan the
 * bookings that reference this trip or churn the layover history.
 */
export async function updateMyActiveLayover(
  patch: ActiveLayoverPatch,
): Promise<void> {
  await updateMyTravelerProfile(patch);
}

/**
 * Archive the current active layover and create the traveler's next one.
 * The server transaction keeps historical trips intact and guarantees that
 * the traveler has at most one active layover.
 */
export async function createMyNextLayover(
  payload: NextLayoverPayload,
): Promise<TravelerProfile> {
  const { error } = await supabase.rpc("create_my_next_layover", {
    p_arrival_at: payload.arrival_at,
    p_departure_at: payload.departure_at,
    p_flight_in: payload.flight_in ?? null,
    p_flight_out: payload.flight_out ?? null,
    p_group_size: payload.group_size,
    p_airport_code: payload.airport_code ?? "BOM",
    p_party_type: payload.party_type ?? null,
  });
  if (error) throw error;

  const saved = await fetchMyTravelerProfile();
  if (!saved?.active_layover_id) {
    throw new Error("Your new layover could not be loaded.");
  }
  return saved;
}
