// ============================================================================
// END-TRIP — Phase 4 Edge Function (buddy)
// ============================================================================
// Transitions booking in_progress → awaiting_proofs.
//
// Inputs: { booking_id: uuid }  Auth: buddy JWT
// Returns: { ok, booking_status }
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';

const PROOFS_DUE_HOURS = 24;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  let body: { booking_id: string };
  try { body = await req.json(); }
  catch { return errorResponse('invalid_json', 400); }

  if (!body.booking_id) return errorResponse('booking_id required', 400);

  const db = adminClient();

  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('id, guide_id, status')
    .eq('id', body.booking_id)
    .single();

  if (bErr || !booking)               return errorResponse('booking_not_found', 404);
  if (booking.guide_id !== caller.userId) return errorResponse('forbidden', 403);
  if (booking.status !== 'in_progress')  return errorResponse(`not_in_progress:${booking.status}`, 409);

  // Cancel any un-captured top-up requests for this booking.
  await db
    .from('top_up_requests')
    .update({ status: 'cancelled' })
    .eq('booking_id', body.booking_id)
    .in('status', ['pending', 'approved']);

  const proofsDueAt = new Date(Date.now() + PROOFS_DUE_HOURS * 60 * 60 * 1000).toISOString();

  const { error: updErr } = await db
    .from('bookings')
    .update({
      status:        'awaiting_proofs',
      proofs_due_at: proofsDueAt,
    })
    .eq('id', body.booking_id)
    .eq('status', 'in_progress');

  if (updErr) return errorResponse(`update_failed: ${updErr.message}`, 500);

  return jsonResponse({ ok: true, booking_status: 'awaiting_proofs', proofs_due_at: proofsDueAt });
});
