// Service-role + anon-key Supabase clients for Edge Functions.
//
// Pattern (used by sign-agreement and create-deposit-order):
//   1. Decode the caller's JWT with the ANON-key client (`getUserFromRequest`)
//      to discover their auth.uid() — service-role bypasses RLS so we cannot
//      use it for that step.
//   2. Use the SERVICE-ROLE client (`adminClient`) for the privileged write
//      after we've confirmed the caller is allowed.
//
// The webhook function only uses the service-role client (Razorpay calls us;
// no end-user JWT is involved).

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

/** Service-role client. Bypasses RLS. Use only after authn/authz checks. */
export function adminClient(): SupabaseClient {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );
}

/** Anon-key client. Use this to decode a user JWT with `auth.getUser(token)`. */
export function anonClient(): SupabaseClient {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
}

export interface CallerIdentity {
  userId: string;
}

export interface CallerLookupOptions {
  /** The deletion endpoint must stay retryable after the durable DB gate is set. */
  allowDeletionPending?: boolean;
}

/**
 * Decode the caller's bearer token and return their auth.uid().
 * Returns null if the header/token is invalid or the public account has been
 * disabled for deletion. Privileged functions must not trust a still-live
 * access JWT after the deletion workflow begins.
 */
export async function getUserFromRequest(
  req: Request,
  options: CallerLookupOptions = {},
): Promise<CallerIdentity | null> {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1];
  const { data, error } = await anonClient().auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: publicUser, error: profileError } = await adminClient()
    .from('users')
    .select('deletion_pending_at, deleted_at')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError || !publicUser) return null;
  if (
    !options.allowDeletionPending
    && (publicUser.deletion_pending_at || publicUser.deleted_at)
  ) {
    return null;
  }

  return { userId: data.user.id };
}
