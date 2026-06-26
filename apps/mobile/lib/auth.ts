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
  const { error } = await supabase.auth.resetPasswordForEmail(email);
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
