import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient, getUserFromRequest } from '../_shared/supabaseAdmin.ts';
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 405);
  const caller = await getUserFromRequest(req);
  if (!caller) return errorResponse('unauthorized', 401);
  let body: Record<string, unknown>;
  try { const raw = await req.text(); if (new TextEncoder().encode(raw).length > 8192) return errorResponse('payload_too_large', 413); body = JSON.parse(raw); } catch { return errorResponse('invalid_json', 400); }
  if (!body || typeof body.booking_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.booking_id)) return errorResponse('invalid_booking_id', 400);
  const db = adminClient();
  const { data: booking, error } = await db.from('bookings').select('id,traveler_id,guide_id').eq('id', body.booking_id).maybeSingle();
  if (error || !booking) return errorResponse('booking_not_found', 404);
  if (caller.userId !== booking.traveler_id && caller.userId !== booking.guide_id) return errorResponse('forbidden', 403);
  if (body.action === 'list') {
    const result = await db.from('booking_support_cases').select('*').eq('booking_id', booking.id).order('created_at', { ascending: false }).limit(20);
    return result.error ? errorResponse('support_unavailable', 503) : jsonResponse({ cases: result.data });
  }
  if (!['no_show','dispute'].includes(String(body.kind)) || typeof body.reason !== 'string' || body.reason.trim().length < 4 || body.reason.length > 2000) return errorResponse('invalid_support_report', 400);
  const result = await db.rpc('report_booking_support_tx', { p_booking_id: booking.id, p_actor_id: caller.userId, p_kind: body.kind, p_reason: body.reason });
  if (result.error) {
    const known = ['no_show_grace_period','dispute_window_closed','dispute_not_available','payment_in_progress'];
    return errorResponse(known.find(k => result.error.message.includes(k)) ?? 'support_report_failed', 409);
  }
  return jsonResponse({ case: result.data });
});
