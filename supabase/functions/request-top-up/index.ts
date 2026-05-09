// ============================================================================
// REQUEST-TOP-UP — Phase 4 Edge Function (buddy)
// ============================================================================
// Creates a top_up_requests row so the traveler sees it via Realtime.
//
// Inputs: { booking_id, requested_paise, category, purpose }  Auth: buddy JWT
//
// Guards:
//   1. Caller must be the guide on the booking.
//   2. Booking status must be 'in_progress'.
//   3. No existing pending or approved top-up for this booking (enforced by
//      partial unique index on (booking_id) WHERE status IN ('pending','approved')).
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  let body: {
    booking_id:      string;
    requested_paise: number;
    category:        string;
    purpose:         string;
  };
  try { body = await req.json(); }
  catch { return errorResponse('invalid_json', 400); }

  const { booking_id, requested_paise, category, purpose } = body;
  if (!booking_id)          return errorResponse('booking_id required', 400);
  if (!requested_paise || requested_paise <= 0)
    return errorResponse('requested_paise must be positive', 400);
  if (!category)            return errorResponse('category required', 400);
  if (!purpose?.trim())     return errorResponse('purpose required', 400);

  const db = adminClient();

  // ── 1. Load booking ────────────────────────────────────────────────────────
  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('id, guide_id, traveler_id, status')
    .eq('id', booking_id)
    .single();

  if (bErr || !booking)                   return errorResponse('booking_not_found', 404);
  if (booking.guide_id !== caller.userId) return errorResponse('forbidden', 403);
  if (booking.status !== 'in_progress')   return errorResponse(`not_in_progress:${booking.status}`, 409);

  // ── 2. Insert top_up_request ───────────────────────────────────────────────
  // The partial unique index enforces at most one pending/approved per booking.
  const expiresAt = new Date(Date.now() + 15 * 60 * 1_000).toISOString(); // +15 min

  const { data: topUp, error: insertErr } = await db
    .from('top_up_requests')
    .insert({
      booking_id,
      created_by_user_id: caller.userId,
      requested_paise,
      category,
      purpose: purpose.trim(),
      status:  'pending',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertErr) {
    // Unique violation → already a pending/approved top-up in flight.
    if (insertErr.code === '23505') {
      return errorResponse('top_up_already_pending', 409);
    }
    return errorResponse(`insert_failed: ${insertErr.message}`, 500);
  }

  return jsonResponse({ ok: true, top_up_request: topUp });
});
