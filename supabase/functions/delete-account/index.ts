// ============================================================================
// DELETE-ACCOUNT — user-initiated account deletion (Apple 5.1.1(v))
// ============================================================================
// The caller deletes THEIR OWN account. We:
//   1. Refuse if they have a booking still in flight (money/logistics pending,
//      or an open dispute) — they must finish or cancel it first.
//   2. Anonymize personal data in public tables. bookings reference users with
//      ON DELETE RESTRICT and carry financial/tax records, so the row is
//      scrubbed-in-place rather than hard-deleted (disclosed to the user).
//   3. Delete the auth login so the account can never be signed into again.
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

// Booking states in which deletion is SAFE — the trip is over or never started
// and no money is in flight. Anything else blocks deletion.
const TERMINAL_STATES = new Set<string>([
  'completed',
  'rated',
  'cancelled',
  'cancelled_no_pay',
  'cancelled_traveler_voluntary',
  'cancelled_buddy',
  'cancelled_force_majeure',
  'cancelled_pre_signing',
  'cancelled_no_deposit',
]);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);
  const uid = caller.userId;

  const db = adminClient();

  // 1. Block if any booking (as traveler OR guide) is still in flight.
  const { data: activeBookings, error: bookingErr } = await db
    .from('bookings')
    .select('id, status')
    .or(`traveler_id.eq.${uid},guide_id.eq.${uid}`);
  if (bookingErr) return errorResponse(`booking_lookup_failed: ${bookingErr.message}`, 500);

  const inFlight = (activeBookings ?? []).filter((b) => !TERMINAL_STATES.has(b.status));
  if (inFlight.length > 0) {
    return errorResponse('active_bookings', 409, {
      message:
        'You have a trip in progress. Please complete or cancel it before deleting your account.',
      active_count: inFlight.length,
    });
  }

  // 2. Anonymize PII. email is NOT NULL + UNIQUE + format-checked, so we write a
  // unique, valid tombstone rather than nulling it.
  const tombstoneEmail = `deleted+${uid}@deleted.detourtrips.com`;
  const { error: userErr } = await db
    .from('users')
    .update({
      email: tombstoneEmail,
      full_name: 'Deleted account',
      phone: null,
      avatar_url: null,
    })
    .eq('id', uid);
  if (userErr) return errorResponse(`anonymize_failed: ${userErr.message}`, 500);

  // Best-effort scrubs of the extended-profile PII. A failure here shouldn't
  // strand the deletion — the identity row (above) is already anonymized.
  await db
    .from('traveler_profiles')
    .update({
      nationality: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      gender: null,
    })
    .eq('user_id', uid);

  await db
    .from('guide_profiles')
    .update({ is_active: false, bio: null, video_intro_url: null })
    .eq('user_id', uid);

  await db
    .from('user_push_tokens')
    .update({ is_valid: false, invalidated_at: new Date().toISOString(), invalidated_reason: 'account_deleted' })
    .eq('user_id', uid);

  // 3. Revoke the login. After this the account cannot be signed into again.
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
