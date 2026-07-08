import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { invalidateOwnPushTokenOnLogout } from './push/registerPushToken';

async function syncCurrentAuthUser(): Promise<void> {
  const { error } = await supabase.rpc('sync_current_auth_user');

  if (error) {
    // Keep auth state deterministic if database provisioning cannot run.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {
      // Ignore cleanup errors.
    });
    throw new Error(
      `Account provisioning failed: ${error.message}. Apply the auth sync SQL migration and retry.`,
    );
  }
}

export async function signUp(email: string, password: string, name: string, role: 'traveler' | 'guide' = 'traveler') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name.trim(),
        role,
      },
    },
  });
  if (error) throw error;

  if (data.user && data.session) {
    await syncCurrentAuthUser();
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  if (data.user) {
    await syncCurrentAuthUser();
  }

  return data;
}

export async function signOut() {
  // Invalidate this device's Expo Push token BEFORE signing out, so the
  // session is still valid when we run the DB write. Without this, a shared
  // phone keeps receiving pushes addressed to the previous user — and the
  // user_push_tokens row stays `is_valid=true` until the server next sees
  // a delivery failure. Best-effort: swallow errors so a logout that fails
  // to reach the DB doesn't block the user from signing out.
  await invalidateOwnPushTokenOnLogout().catch(() => { /* best-effort */ });

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  // The reset email must deep-link back into the app so the recovery session
  // can be established and the user routed to the set-new-password screen.
  // `Linking.createURL('reset-password')` resolves to the right scheme in every
  // environment: `detour://reset-password` in a standalone/dev build, and the
  // `exp://…/--/reset-password` proxy URL under Expo Go. The resulting URL must
  // be in the Supabase Auth "Redirect URLs" allow-list for production.
  const redirectTo = Linking.createURL('reset-password');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/**
 * Set a new password for the currently-authenticated user. During the reset
 * flow the "current user" is the short-lived recovery session established from
 * the emailed link (see lib/auth/recoveryLink.ts). Requires an active session —
 * throws otherwise (e.g. an expired/consumed recovery link).
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Determine if the logged-in user is a guide or traveler.
 * Priority: active guide_profiles row → user_metadata.role → default traveler.
 */
export async function getUserRole(userId: string): Promise<'guide' | 'traveler'> {
  const { data } = await supabase
    .from('guide_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (data) return 'guide';

  // New guide signups don't have a guide_profile yet — check their signup intent.
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === userId && user.user_metadata?.role === 'guide') return 'guide';

  return 'traveler';
}
