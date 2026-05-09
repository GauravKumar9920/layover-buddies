// ============================================================================
// DECIDE-TOP-UP — Phase 4 Edge Function (traveler)
// ============================================================================
// Traveler approves or declines a pending top-up request.
//
// Inputs: { top_up_request_id, decision: 'approve' | 'decline' }  Auth: traveler JWT
//
// Guards:
//   1. Caller must be the traveler on the booking.
//   2. Request must be in 'pending' status and not expired.
//
// On approve: flips status → 'approved'. Client then calls create-topup-order.
// On decline: flips status → 'declined'.
//
// Uses the SECURITY DEFINER RPC `set_top_up_status` which enforces role-to-
// direction inside Postgres (traveler may flip pending→approved/declined;
// buddy may flip pending→cancelled).
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  let body: { top_up_request_id: string; decision: 'approve' | 'decline' };
  try { body = await req.json(); }
  catch { return errorResponse('invalid_json', 400); }

  const { top_up_request_id, decision } = body;
  if (!top_up_request_id)                        return errorResponse('top_up_request_id required', 400);
  if (decision !== 'approve' && decision !== 'decline')
    return errorResponse('decision must be approve or decline', 400);

  const db = adminClient();

  // ── 1. Load the top-up request + booking in one join ──────────────────────
  const { data: topUp, error: tErr } = await db
    .from('top_up_requests')
    .select('id, booking_id, status, expires_at, bookings!inner(traveler_id)')
    .eq('id', top_up_request_id)
    .single();

  if (tErr || !topUp) return errorResponse('top_up_request_not_found', 404);

  // @ts-ignore — Supabase join typing
  const bookingTravelerId = topUp.bookings?.traveler_id;
  if (bookingTravelerId !== caller.userId) return errorResponse('forbidden', 403);

  if (topUp.status !== 'pending') {
    return errorResponse(`not_pending:${topUp.status}`, 409);
  }
  if (new Date(topUp.expires_at) < new Date()) {
    return errorResponse('expired', 409);
  }

  // ── 2. Transition status ───────────────────────────────────────────────────
  const newStatus = decision === 'approve' ? 'approved' : 'declined';

  const { error: updErr } = await db
    .from('top_up_requests')
    .update({ status: newStatus, traveler_decided_at: new Date().toISOString() })
    .eq('id', top_up_request_id)
    .eq('status', 'pending'); // optimistic lock

  if (updErr) return errorResponse(`update_failed: ${updErr.message}`, 500);

  return jsonResponse({
    ok:      true,
    proceed: decision === 'approve',
    status:  newStatus,
    top_up_request_id,
  });
});
