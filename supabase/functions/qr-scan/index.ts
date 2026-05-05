// ============================================================================
// QR-SCAN — Phase 4 Edge Function (buddy)
// ============================================================================
// Called when the buddy scans the traveler's QR code to start the trip.
//
// Inputs: { booking_id: uuid, token: string }  Auth: buddy JWT
//
// Behaviour:
//   1. Atomic UPDATE bookings SET status='in_progress', trip_qr_scanned_at=now()
//      WHERE id=? AND trip_qr_token=? AND status='trip_ready'. Returns 409 if
//      token doesn't match or status is wrong (idempotent).
//   2. Release trip pot: create payout_dispatches row 'trip_pot_release' for
//      buddy. Dispatches via razorpayClient.createPayout (stub-safe).
//   3. Returns { ok, booking_status, trip_pot_paise, stubbed }.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';
import {
  createPayout,
  createFundAccount,
  idempotencyKey,
  RazorpayLiveNotConfiguredError,
} from '../_shared/razorpayClient.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);

  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);

  let body: { booking_id: string; token: string };
  try { body = await req.json(); }
  catch { return errorResponse('invalid_json', 400); }

  const { booking_id, token } = body;
  if (!booking_id || !token) return errorResponse('booking_id and token required', 400);

  const db = adminClient();

  // ── 1. Load + validate booking ────────────────────────────────────────────
  const { data: booking, error: bErr } = await db
    .from('bookings')
    .select('id, guide_id, traveler_id, status, trip_qr_token')
    .eq('id', booking_id)
    .single();

  if (bErr || !booking) return errorResponse('booking_not_found', 404);
  if (booking.guide_id !== caller.userId) return errorResponse('forbidden', 403);
  if (booking.status !== 'trip_ready')    return errorResponse(`booking_status_not_trip_ready:${booking.status}`, 409);
  if (booking.trip_qr_token !== token)    return errorResponse('invalid_token', 409);

  // ── 2. Atomic status transition ──────────────────────────────────────────
  const { error: transErr } = await db
    .from('bookings')
    .update({
      status:                    'in_progress',
      trip_qr_scanned_at:        new Date().toISOString(),
      trip_qr_scanned_by_user_id: caller.userId,
    })
    .eq('id', booking_id)
    .eq('status', 'trip_ready')
    .eq('trip_qr_token', token);

  if (transErr) return errorResponse(`transition_failed: ${transErr.message}`, 500);

  // ── 3. Load agreement for trip pot amount ────────────────────────────────
  const { data: agreement } = await db
    .from('agreements')
    .select('itinerary_fund_paise, buffer_paise, buddy_fee_paise')
    .eq('booking_id', booking_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Captured top-ups also included in trip pot release.
  const { data: topUps } = await db
    .from('payment_events')
    .select('amount_paise')
    .eq('booking_id', booking_id)
    .eq('kind', 'top_up')
    .eq('status', 'captured');

  const capturedTopUps = (topUps ?? []).reduce((s: number, r: { amount_paise: number }) => s + r.amount_paise, 0);
  const tripPotPaise = (agreement?.itinerary_fund_paise ?? 0) +
                       (agreement?.buffer_paise ?? 0) +
                       capturedTopUps;

  // ── 4. Buddy VPA check ───────────────────────────────────────────────────
  const { data: buddy } = await db
    .from('users')
    .select('payout_vpa, razorpay_fund_account_id')
    .eq('id', caller.userId)
    .single();

  if (!buddy?.payout_vpa) {
    return jsonResponse({
      ok:             true,
      booking_status: 'in_progress',
      trip_pot_paise: tripPotPaise,
      error:          'vpa_missing',
    });
  }

  // ── 5. Insert payout_dispatches + dispatch (stub-safe) ───────────────────
  const { data: dispatch } = await db
    .from('payout_dispatches')
    .insert({
      booking_id:        booking_id,
      kind:              'trip_pot_release',
      recipient_user_id: caller.userId,
      gross_paise:       tripPotPaise,
      net_paise:         tripPotPaise,
    })
    .select('id')
    .single();

  let stubbed = false;
  try {
    const iKey = await idempotencyKey(['trip_pot', booking_id, caller.userId]);

    let fundAccountId = buddy.razorpay_fund_account_id;
    if (!fundAccountId) {
      const fa = await createFundAccount({
        contact_id:          caller.userId,
        vpa:                 buddy.payout_vpa,
        account_holder_name: '',
      });
      fundAccountId = fa.fund_account_id;
      await db.from('users').update({ razorpay_fund_account_id: fundAccountId }).eq('id', caller.userId);
    }

    const result = await createPayout({
      fund_account_id: fundAccountId,
      amount_paise:    tripPotPaise,
      idempotency_key: iKey,
      notes: { booking_id, kind: 'trip_pot_release' },
    });

    await db.from('bookings').update({ trip_pot_released_at: new Date().toISOString() }).eq('id', booking_id);
    if (dispatch?.id) {
      await db.from('payout_dispatches').update({
        status: 'sent', razorpay_payout_id: result.payout_id,
        razorpay_fund_account_id: fundAccountId,
        completed_at: new Date().toISOString(),
      }).eq('id', dispatch.id);
    }
  } catch (err) {
    stubbed = true;
    if (err instanceof RazorpayLiveNotConfiguredError) {
      if (dispatch?.id) {
        await db.from('payout_dispatches')
          .update({ failed_reason: 'razorpay_live_not_configured' })
          .eq('id', dispatch.id);
      }
    } else {
      if (dispatch?.id) {
        await db.from('payout_dispatches')
          .update({ status: 'failed', failed_reason: String(err) })
          .eq('id', dispatch.id);
      }
    }
  }

  return jsonResponse({ ok: true, booking_status: 'in_progress', trip_pot_paise: tripPotPaise, stubbed });
});
