// ============================================================================
// TRAVELER PROFILE — onboarding fields (nationality, layover, interests)
// ============================================================================
// Used by the post-signup onboarding screen and read by Explore + booking
// flows so they can show time-fit badges and rank guides by interest overlap.
// ============================================================================

import { supabase } from '../supabase';

export interface TravelerProfile {
  user_id:                   string;
  nationality:               string | null;
  gender:                    string | null;   // 'female' | 'male' | 'non_binary' | 'prefer_not_to_say'
  preferred_language:        string | null;
  emergency_contact_name:    string | null;
  emergency_contact_phone:   string | null;
  arrival_at:                string | null;   // ISO timestamp
  departure_at:              string | null;
  flight_in:                 string | null;
  flight_out:                string | null;
  interests:                 string[];
  onboarded_at:              string | null;
}

export interface OnboardingPayload {
  nationality:   string;
  gender?:       string | null;
  arrival_at:    string;
  departure_at:  string;
  flight_in?:    string | null;
  flight_out?:   string | null;
  interests:     string[];
}

/** Fetch the signed-in traveler's profile row. Returns null if no row exists
 *  yet — the auth-sync trigger creates skeleton rows on signup but a brand
 *  new user landing on root may briefly see null until that fires. */
export async function fetchMyTravelerProfile(): Promise<TravelerProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('traveler_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as TravelerProfile | null) ?? null;
}

/** Persist all onboarding answers in one round-trip and mark the user as
 *  onboarded so the root layout stops force-routing them here. */
export async function completeOnboarding(payload: OnboardingPayload): Promise<TravelerProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Upsert so we don't fail if the trigger hasn't yet created the row.
  const { data, error } = await supabase
    .from('traveler_profiles')
    .upsert(
      {
        user_id:      user.id,
        nationality:  payload.nationality,
        gender:       payload.gender ?? null,
        arrival_at:   payload.arrival_at,
        departure_at: payload.departure_at,
        flight_in:    payload.flight_in ?? null,
        flight_out:   payload.flight_out ?? null,
        interests:    payload.interests,
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as TravelerProfile;
}

/** Fields the traveler can edit from their Profile tab. `full_name` and
 *  `avatar_url` live on the `users` table; everything else on
 *  `traveler_profiles`. Pass only what changed. */
export interface TravelerProfilePatch {
  full_name?: string;
  avatar_url?: string;
  nationality?: string | null;
  gender?: string | null;
  preferred_language?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  interests?: string[];
}

/** Persist a partial edit to the signed-in traveler's profile. Splits writes
 *  across `users` (name/avatar) and `traveler_profiles` (everything else),
 *  mirroring how `updateGuideProfile` handles the same split. */
export async function updateMyTravelerProfile(patch: TravelerProfilePatch): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { full_name, avatar_url, ...profileFields } = patch;

  // users table — name + avatar
  if (full_name !== undefined || avatar_url !== undefined) {
    const userUpdates: Record<string, unknown> = {};
    if (full_name !== undefined) userUpdates.full_name = full_name;
    if (avatar_url !== undefined) userUpdates.avatar_url = avatar_url;
    const { error } = await supabase.from('users').update(userUpdates).eq('id', user.id);
    if (error) throw error;
  }

  // traveler_profiles — onboarding/contact fields. Upsert so a missing row
  // (trigger hasn't fired) doesn't fail the save.
  if (Object.keys(profileFields).length > 0) {
    const { error } = await supabase
      .from('traveler_profiles')
      .upsert({ user_id: user.id, ...profileFields }, { onConflict: 'user_id' });
    if (error) throw error;
  }
}
