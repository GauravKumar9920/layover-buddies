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

type StorageEntry = {
  id?: string | null;
  name: string;
};

async function collectStoragePaths(
  db: ReturnType<typeof adminClient>,
  bucket: string,
  prefix: string,
  matches: (entry: StorageEntry) => boolean,
  paths: string[],
): Promise<string | null> {
  let offset = 0;

  while (true) {
    const { data, error } = await db.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset });
    if (error) return `${bucket}/${prefix}: ${error.message}`;

    const entries = (data ?? []) as StorageEntry[];
    for (const entry of entries) {
      if (!entry.name) continue;
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        if (matches(entry)) paths.push(entryPath);
      } else {
        const nestedError = await collectStoragePaths(
          db,
          bucket,
          entryPath,
          matches,
          paths,
        );
        if (nestedError) return nestedError;
      }
    }

    if (entries.length < 100) return null;
    offset += entries.length;
  }
}

async function removeStorageMatches(
  db: ReturnType<typeof adminClient>,
  bucket: string,
  prefix: string,
  matches: (entry: StorageEntry) => boolean,
): Promise<string | null> {
  const paths: string[] = [];
  const listError = await collectStoragePaths(db, bucket, prefix, matches, paths);
  if (listError) return listError;

  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await db.storage.from(bucket).remove(paths.slice(offset, offset + 100));
    if (error) return `${bucket}/${prefix}: ${error.message}`;
  }

  return null;
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
    const storageError = await removeStorageMatches(db, bucket, prefix, () => true);
    if (storageError) {
      return errorResponse(`storage_cleanup_failed: ${storageError}`, 500);
    }
  }

  // Older policies allowed matching avatar filenames inside deeper folders.
  // Walk the whole avatars namespace so account deletion cleans those legacy
  // objects too; current policies now permit only avatars/<uid>.<ext>.
  const avatarError = await removeStorageMatches(
    db,
    'avatars',
    'avatars',
    (entry) => entry.name.startsWith(`${uid}.`),
  );
  if (avatarError) {
    return errorResponse(`storage_cleanup_failed: ${avatarError}`, 500);
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
