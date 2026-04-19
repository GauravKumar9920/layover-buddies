import { supabase } from './supabase';
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

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name.trim(),
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
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/**
 * Determine if the logged-in user is a guide or traveler.
 * Rule: if a row exists in guide_profiles with is_active=true → guide, else → traveler.
 */
export async function getUserRole(userId: string): Promise<'guide' | 'traveler'> {
  const { data } = await supabase
    .from('guide_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  return data ? 'guide' : 'traveler';
}
