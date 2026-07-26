// ============================================================================
// DELETE-ACCOUNT — user-initiated account deletion (Apple 5.1.1(v))
// ============================================================================
// The caller deletes THEIR OWN account. We:
//   1. Refuse if they have a booking still in flight (money/logistics pending,
//      or an open dispute) — they must finish or cancel it first.
//   2. Delete user-owned profile/media objects from Storage.
//   3. Atomically anonymize personal data in public tables. bookings reference
//      users and carry financial/tax records, so the identity row is retained
//      as a tombstone while profile/location/free-text data is scrubbed.
//   4. Delete the auth login so the account can never be signed into again.
//
// Order matters: scrub PII FIRST (the GDPR-critical step), THEN revoke the
// login. If the login deletion fails the caller can safely retry — every step
// is idempotent.
//
// Auth: end-user bearer JWT (the user acts on their own account).
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';

async function removeStoragePrefix(
  db: ReturnType<typeof adminClient>,
  bucket: string,
  prefix: string,
): Promise<string | null> {
  // Always list from offset zero because each successful removal shrinks the
  // prefix. This also handles more than the Storage API's 100-object page.
  while (true) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 100 });
    if (error) return `${bucket}/${prefix}: ${error.message}`;

    const paths = (data ?? [])
      .filter((entry) => entry.name && entry.id)
      .map((entry) => `${prefix}/${entry.name}`);
    if (paths.length === 0) return null;

    const { error: removeError } = await db.storage.from(bucket).remove(paths);
    if (removeError) return `${bucket}/${prefix}: ${removeError.message}`;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  const caller = await getUserFromRequest(req, { allowDeletionPending: true });
  if (!caller) return errorResponse('unauthorized', 401);
  const uid = caller.userId;

  const db = adminClient();

  // 1. Atomically lock bookings, verify all trip/payment work is settled, and
  // set the durable deletion gate before touching cross-service resources.
  const { error: prepareError } = await db.rpc('prepare_account_deletion_tx', {
    p_user_id: uid,
  });
  if (prepareError?.message.includes('active_bookings')) {
    return errorResponse('active_bookings', 409, {
      message:
        'You have a trip in progress. Please complete or cancel it before deleting your account.',
    });
  }
  if (prepareError?.message.includes('financial_settlement_pending')) {
    return errorResponse('financial_settlement_pending', 409, {
      message:
        'A payment, refund, or payout is still settling. Please try again after it finishes or contact support.',
    });
  }
  if (prepareError) {
    return errorResponse(`deletion_prepare_failed: ${prepareError.message}`, 500);
  }

  // 2. Remove identity/profile uploads. All current app-owned profile media
  // paths are namespaced by user id; expense proofs are retained with the
  // corresponding financial records.
  const storagePrefixes: Array<[string, string]> = [
    ['itinerary-photos', uid],
    ['itinerary-photos', `gallery/${uid}`],
    ['itinerary-photos', `stops/${uid}`],
  ];
  for (const [bucket, prefix] of storagePrefixes) {
    const storageError = await removeStoragePrefix(db, bucket, prefix);
    if (storageError) {
      return errorResponse(`storage_cleanup_failed: ${storageError}`, 500);
    }
  }

  // Avatars live at avatars/<uid>.<ext>, so the shared directory needs a
  // filtered pass rather than a broad prefix deletion.
  const { data: avatarEntries, error: avatarListError } =
    await db.storage.from('avatars').list('avatars', { limit: 100, search: uid });
  if (avatarListError) {
    return errorResponse(`storage_cleanup_failed: avatars: ${avatarListError.message}`, 500);
  }
  const avatarPaths = (avatarEntries ?? [])
    .filter((entry) => entry.id && entry.name.startsWith(`${uid}.`))
    .map((entry) => `avatars/${entry.name}`);
  if (avatarPaths.length > 0) {
    const { error: avatarRemoveError } = await db.storage.from('avatars').remove(avatarPaths);
    if (avatarRemoveError) {
      return errorResponse(`storage_cleanup_failed: avatars: ${avatarRemoveError.message}`, 500);
    }
  }

  // 3. Scrub every database surface in one transaction. The RPC is
  // service-role-only and derives the tombstone from the authenticated uid.
  const { error: anonymizeError } = await db.rpc('anonymize_user_data_tx', {
    p_user_id: uid,
  });
  if (anonymizeError) {
    return errorResponse(`anonymize_failed: ${anonymizeError.message}`, 500);
  }

  // 4. Revoke the login. After this the account cannot be signed into again.
  const { error: authErr } = await db.auth.admin.deleteUser(uid);
  if (authErr) {
    return errorResponse('account_deletion_incomplete', 500, {
      message:
        'Your personal data was removed but the sign-in could not be revoked. Please try again.',
      detail: authErr.message,
    });
  }

  return jsonResponse({ ok: true });
});
