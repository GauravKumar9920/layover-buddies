// ============================================================================
// SIGN-AGREEMENT (Phase 2 Edge Function)
// ============================================================================
// Atomically:
//   1. Validates the caller is a party to the booking on the requested side.
//   2. Calls sign_agreement_tx() RPC to set the timestamp + advance
//      agreements.status to signed_traveler / signed_guide / fully_signed.
//   3. Computes the next bookings.status via the shared state-machine
//      reducer using the post-write guard context, and writes it.
//
// Why an Edge function (and not direct RLS write):
//   - Phase 1 RLS only grants UPDATE on `agreements` to the drafter (the
//     buddy) via `agreements_update_buddy`. The traveler signature MUST go
//     through service role.
//   - Routing the buddy through the same path means there's exactly one
//     server-side place that calls `transition()` after a sign, ensuring the
//     post-write guard is computed correctly under all races.
//
// Inputs (POST JSON body):
//   { booking_id: uuid, side: 'traveler' | 'buddy', full_name: string }
// Returns:
//   { ok: true, booking_status, agreement_status }
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';
import {
  transition,
  type BookingEvent,
  type BookingState,
  type GuardContext,
} from '../_shared/stateMachine.ts';

interface RequestBody {
  booking_id: string;
  side: 'traveler' | 'buddy';
  full_name: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  // ── Authn ────────────────────────────────────────────────────────────────
  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  // ── Body parse + shape validation ────────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return errorResponse('invalid_json', 400);
  }
  if (!body.booking_id || (body.side !== 'traveler' && body.side !== 'buddy')) {
    return errorResponse('booking_id and side ("traveler"|"buddy") are required', 400);
  }
  if (!body.full_name || body.full_name.trim().length === 0) {
    return errorResponse('full_name is required', 422);
  }

  const supabase = adminClient();

  // ── Authz: caller must be on the requested side ──────────────────────────
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, traveler_id, guide_id, status')
    .eq('id', body.booking_id)
    .maybeSingle();

  if (bookingErr) return errorResponse(`db_error: ${bookingErr.message}`, 500);
  if (!booking)   return errorResponse('booking_not_found', 404);

  const expectedUserId = body.side === 'traveler' ? booking.traveler_id : booking.guide_id;
  if (expectedUserId !== caller.userId) {
    return errorResponse('forbidden', 403);
  }

  // ── Find the agreement; verify it's in a signable state ──────────────────
  const { data: agreement, error: agrErr } = await supabase
    .from('agreements')
    .select('id, status, traveler_signed_at, buddy_signed_at')
    .eq('booking_id', body.booking_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (agrErr)     return errorResponse(`db_error: ${agrErr.message}`, 500);
  if (!agreement) return errorResponse('agreement_not_found', 404);

  // Already signed by this side? Idempotent success — check before the
  // status gate so `fully_signed` also returns 200 for replays.
  const alreadySigned =
    (body.side === 'traveler' && agreement.traveler_signed_at !== null)
    || (body.side === 'buddy' && agreement.buddy_signed_at !== null);
  if (alreadySigned) {
    return jsonResponse({
      ok:               true,
      booking_status:   booking.status,
      agreement_status: agreement.status,
      already_signed:   true,
    });
  }

  const signableStatuses = ['sent', 'signed_traveler', 'signed_guide'];
  if (!signableStatuses.includes(agreement.status)) {
    return errorResponse('agreement_not_signable', 409, { current_status: agreement.status });
  }

  // ── Atomic timestamp + agreement_status write via RPC ────────────────────
  // Pass the full_name so it is persisted alongside the timestamp as the
  // audit record for the e-signature (IT Act 2000 §10A).
  const { data: rpcResult, error: rpcErr } = await supabase
    .rpc('sign_agreement_tx', {
      p_agreement_id: agreement.id,
      p_side:         body.side,
      p_signed_name:  body.full_name.trim(),
    })
    .single();

  if (rpcErr || !rpcResult) {
    return errorResponse(`rpc_error: ${rpcErr?.message ?? 'unknown'}`, 500);
  }

  const bothSignaturesPresent = rpcResult.both_signatures_present === true;
  const newAgreementStatus    = rpcResult.agreement_status as string;

  // ── Compute next booking state via the shared reducer ────────────────────
  const event: BookingEvent =
    body.side === 'traveler' ? { kind: 'traveler_signs' } : { kind: 'buddy_signs' };

  const ctx: GuardContext = { bothSignaturesPresent, bothDepositsHeld: false };

  const result = transition(booking.status as BookingState, event, ctx);
  if (!result.ok) {
    // Agreement already updated; surface the booking-side issue without
    // attempting a rollback (the agreement timestamps are themselves the
    // source of truth and recover-able by ops).
    return errorResponse('illegal_booking_transition', 409, {
      from:             booking.status,
      attempted:        event.kind,
      agreement_status: newAgreementStatus,
    });
  }

  const { error: bookingUpdateErr } = await supabase
    .from('bookings')
    .update({ status: result.next })
    .eq('id', body.booking_id);

  if (bookingUpdateErr) {
    return errorResponse(`db_error: ${bookingUpdateErr.message}`, 500);
  }

  return jsonResponse({
    ok:               true,
    booking_status:   result.next,
    agreement_status: newAgreementStatus,
  });
});
