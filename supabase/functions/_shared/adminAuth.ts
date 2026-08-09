import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { Database } from './database.types.ts';
import { adminClient, anonClient } from './supabaseAdmin.ts';
import type { AdminRole } from './adminContract.ts';

export interface AdminIdentity {
  userId: string;
  email: string | null;
  role: AdminRole;
  aal: 'aal1' | 'aal2';
}

export type AdminAuthResult =
  | { ok: true; identity: AdminIdentity; db: SupabaseClient<Database> }
  | { ok: false; code: string; message: string; status: number };

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replaceAll('-', '+').replaceAll('_', '/')
      + '='.repeat((4 - part.length % 4) % 4);
    const decoded = JSON.parse(atob(base64));
    return typeof decoded === 'object' && decoded !== null ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Validate the JWT with GoTrue before reading any decoded claim. Membership is
 * then loaded with the server-side service client. Decoding alone is never
 * treated as authentication.
 */
export async function authenticateAdmin(
  req: Request,
  options: { requireAal2?: boolean; allowedRoles?: readonly AdminRole[] } = {},
): Promise<AdminAuthResult> {
  const token = bearerToken(req);
  if (!token) return { ok: false, code: 'unauthorized', message: 'Sign in is required.', status: 401 };

  const { data, error } = await anonClient().auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, code: 'unauthorized', message: 'The session is invalid or expired.', status: 401 };
  }

  const db = adminClient() as SupabaseClient<Database>;
  const { data: membership, error: membershipError } = await db
    .from('admin_memberships')
    .select('role, is_active')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (membershipError) {
    return { ok: false, code: 'admin_membership_unavailable', message: 'Admin access could not be verified.', status: 503 };
  }
  if (!membership?.is_active) {
    return { ok: false, code: 'admin_forbidden', message: 'This account is not an active administrator.', status: 403 };
  }

  const role = membership.role as AdminRole;
  if (options.allowedRoles && !options.allowedRoles.includes(role)) {
    return { ok: false, code: 'role_forbidden', message: 'Your admin role cannot perform this operation.', status: 403 };
  }

  const claims = decodeJwtPayload(token);
  const aal = claims?.aal === 'aal2' ? 'aal2' : 'aal1';
  if (options.requireAal2 !== false && aal !== 'aal2') {
    return { ok: false, code: 'mfa_required', message: 'Complete multi-factor authentication to continue.', status: 403 };
  }

  return {
    ok: true,
    identity: { userId: data.user.id, email: data.user.email ?? null, role, aal },
    db,
  };
}
