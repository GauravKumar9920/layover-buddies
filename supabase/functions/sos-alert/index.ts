// ============================================================================
// SOS-ALERT — pages the ops team when a traveler/guide hits SOS
// ============================================================================
// Fired by the `trg_notify_sos_alert` trigger (via pg_net) on every insert into
// `sos_alerts`. Loads the alert + trip context and delivers an out-of-band
// alert (webhook + email) because ops is not an app user with a push token.
//
// Auth: service-role bearer only (the trigger posts the service key; admin
// tooling may also invoke it directly).
// Input: { sos_alert_id: string }
//
// Delivery is best-effort and never blocks the SOS insert (fire-and-forget from
// the trigger). If no channel is configured it returns ok with skipped set so
// the deployer can see, in logs, that ops paging isn't wired yet.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabaseAdmin.ts';
import { timingSafeEqual } from '../_shared/razorpaySignature.ts';
import {
  deliverSosAlert,
  sosConfigFromEnv,
  summarizeSosDelivery,
  type SosContext,
} from '../_shared/sosAlert.ts';

function isServiceRole(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return expected.length > 0 && timingSafeEqual(bearer, expected);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);
  if (!isServiceRole(req))      return errorResponse('unauthorized', 401);

  let body: { sos_alert_id?: string } = {};
  try { body = await req.json(); } catch { /* fallthrough to validation */ }
  const sosAlertId = body.sos_alert_id;
  if (!sosAlertId) return errorResponse('sos_alert_id_required', 400);

  const db = adminClient();

  // 1. The alert itself.
  const { data: alert, error: alertErr } = await db
    .from('sos_alerts')
    .select(
      'id, booking_id, triggered_by, latitude, longitude, triggered_at, status, dispatch_status, dispatch_attempts, dispatch_last_attempt_at, dispatch_channels',
    )
    .eq('id', sosAlertId)
    .single();
  if (alertErr || !alert) return errorResponse(`sos_alert_not_found: ${alertErr?.message ?? ''}`, 404);

  if (alert.dispatch_status === 'delivered') {
    return jsonResponse({
      ok: true,
      already_delivered: true,
      delivered: alert.dispatch_channels ?? [],
      failed: [],
    });
  }

  if (
    alert.dispatch_status === 'dispatching'
    && alert.dispatch_last_attempt_at
    && Date.now() - new Date(alert.dispatch_last_attempt_at).getTime() < 5 * 60 * 1000
  ) {
    return jsonResponse({ ok: true, already_in_progress: true });
  }

  // Atomically claim the attempt. Concurrent trigger/cron invocations both
  // read the same attempt count, but only one conditional update can win.
  const attempt = Number(alert.dispatch_attempts ?? 0) + 1;
  const attemptStartedAt = new Date().toISOString();
  const { data: claim, error: claimError } = await db
    .from('sos_alerts')
    .update({
      dispatch_status: 'dispatching',
      dispatch_attempts: attempt,
      dispatch_last_attempt_at: attemptStartedAt,
    })
    .eq('id', sosAlertId)
    .eq('dispatch_attempts', alert.dispatch_attempts ?? 0)
    .neq('dispatch_status', 'delivered')
    .select('id')
    .maybeSingle();
  if (claimError) return errorResponse(`sos_claim_failed: ${claimError.message}`, 500);
  if (!claim) {
    return jsonResponse({ ok: true, already_in_progress: true });
  }

  // 2. Trip + participants.
  const { data: booking } = await db
    .from('bookings')
    .select('id, traveler_id, guide_id, itinerary_id, tour_start_time')
    .eq('id', alert.booking_id)
    .single();

  const travelerId = booking?.traveler_id ?? null;
  const guideId = booking?.guide_id ?? null;

  const ids = [travelerId, guideId, alert.triggered_by].filter(
    (v): v is string => typeof v === 'string',
  );
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: users } = await db.from('users').select('id, full_name').in('id', ids);
    for (const u of users ?? []) nameById.set(u.id, u.full_name ?? 'Unknown');
  }

  let tourName: string | null = null;
  if (booking?.itinerary_id) {
    const { data: itin } = await db
      .from('itineraries')
      .select('title')
      .eq('id', booking.itinerary_id)
      .single();
    tourName = itin?.title ?? null;
  }

  const triggeredByRole =
    alert.triggered_by === travelerId ? 'traveler'
    : alert.triggered_by === guideId ? 'guide'
    : 'unknown';
  const counterpartId = alert.triggered_by === travelerId ? guideId : travelerId;

  const ctx: SosContext = {
    alertId: alert.id,
    bookingId: alert.booking_id,
    latitude: Number(alert.latitude),
    longitude: Number(alert.longitude),
    triggeredAt: alert.triggered_at,
    triggeredByName: nameById.get(alert.triggered_by) ?? 'A Detour user',
    triggeredByRole,
    counterpartName: (counterpartId && nameById.get(counterpartId)) || 'their trip partner',
    tourName,
    city: 'Mumbai',
    startDate: booking?.tour_start_time ?? null,
  };

  const existingChannels = (alert.dispatch_channels ?? []) as string[];
  const config = sosConfigFromEnv(Deno.env);
  // Never resend a channel that succeeded on an earlier partial attempt.
  if (existingChannels.includes('webhook')) config.webhookUrl = undefined;
  if (existingChannels.includes('email')) {
    config.resendApiKey = undefined;
    config.alertEmail = undefined;
  }
  const result = await deliverSosAlert({ ctx, config, fetchFn: fetch });
  const summary = summarizeSosDelivery(existingChannels, result);

  const { error: stateError } = await db
    .from('sos_alerts')
    .update({
      dispatch_status: summary.status,
      dispatch_channels: summary.channels,
      dispatch_last_error: summary.error,
      delivered_at: summary.status === 'delivered' ? new Date().toISOString() : null,
    })
    .eq('id', sosAlertId)
    .eq('dispatch_attempts', attempt);
  if (stateError) {
    return errorResponse(`sos_delivery_state_failed: ${stateError.message}`, 500);
  }

  // Log so the delivery outcome is visible in Edge function logs even though
  // this runs fire-and-forget from the trigger.
  if (result.skipped) {
    console.warn(`[sos-alert] ${sosAlertId}: no ops channel configured — SOS not paged out-of-band`);
  } else if (result.failed.length > 0) {
    console.error(`[sos-alert] ${sosAlertId}: delivery failures`, JSON.stringify(result.failed));
  } else {
    console.log(`[sos-alert] ${sosAlertId}: delivered via ${result.delivered.join(', ')}`);
  }

  return jsonResponse({ ok: true, ...result, dispatch_status: summary.status });
});
