// ============================================================================
// ACCOUNT API — self-service account deletion (Apple 5.1.1(v))
// ============================================================================
// Invokes the delete-account Edge Function, which anonymizes personal data and
// revokes the sign-in. The caller is responsible for signing out locally after
// a success (the auth user no longer exists, so the session is already dead).
// ============================================================================

import { supabase } from '../supabase';

/**
 * supabase.functions.invoke surfaces non-2xx responses as a FunctionsHttpError
 * whose `.context` is the raw Response. The edge fn returns a human-readable
 * `message` (e.g. the "finish your trip first" 409) — dig it out so the UI can
 * show something better than "Edge Function returned a non-2xx status code".
 */
async function messageFromFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body && typeof body.message === 'string') return body.message;
      if (body && typeof body.error === 'string') return body.error;
    } catch {
      // Non-JSON body — fall through to the generic message.
    }
  }
  return error instanceof Error ? error.message : 'Could not delete your account.';
}

/**
 * Permanently delete the signed-in user's account. Throws with a
 * human-readable message on failure (e.g. an in-flight booking blocks it).
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) {
    throw new Error(await messageFromFunctionError(error));
  }
}
