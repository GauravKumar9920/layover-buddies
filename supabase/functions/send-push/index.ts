// ============================================================================
// SEND-PUSH — Phase 5 Edge Function
// ============================================================================
// Drains the notifications table and posts pending messages to the Expo Push
// API.  Invoked once per minute by cron_send_pending_pushes() via pg_net, or
// manually by service-role admin tooling.
//
// Auth: service-role bearer token only.
// Inputs (optional): { limit?: number }  — defaults to 100; capped at 100.
//
// Behaviour: see _shared/sendPush.ts (drainOnce).
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabaseAdmin.ts';
import {
  drainOnce,
  makeExpoFetch,
  type DbLike,
  type NotificationRow,
  type PushTokenRow,
} from '../_shared/sendPush.ts';

function isServiceRole(req: Request): boolean {
  const auth   = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return expected.length > 0 && bearer === expected;
}

/** Adapt the live supabase-js client to the DbLike interface used by drainOnce. */
function makeLiveDb(): DbLike {
  const db = adminClient();

  return {
    async fetchPendingNotifications(limit: number): Promise<NotificationRow[]> {
      const { data, error } = await db
        .from('notifications')
        .select('id, booking_id, recipient_user_id, kind, payload, deep_link')
        .is('push_sent_at',   null)
        .is('push_failed_at', null)
        .not('recipient_user_id', 'is', null)
        .order('sent_at', { ascending: true })
        .limit(limit);
      if (error) throw new Error(`fetch_pending_failed: ${error.message}`);
      return (data ?? []) as NotificationRow[];
    },

    async fetchValidTokensFor(userIds: string[]): Promise<PushTokenRow[]> {
      if (userIds.length === 0) return [];
      const { data, error } = await db
        .from('user_push_tokens')
        .select('user_id, expo_push_token')
        .in('user_id', userIds)
        .eq('is_valid', true);
      if (error) throw new Error(`fetch_tokens_failed: ${error.message}`);
      return (data ?? []) as PushTokenRow[];
    },

    async markNotificationSent(id: string): Promise<void> {
      const { error } = await db
        .from('notifications')
        .update({ push_sent_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(`mark_sent_failed: ${error.message}`);
    },

    async markNotificationFailed(id: string, reason: string): Promise<void> {
      const { error } = await db
        .from('notifications')
        .update({
          push_failed_at:     new Date().toISOString(),
          push_failed_reason: reason.slice(0, 500),
        })
        .eq('id', id);
      if (error) throw new Error(`mark_failed_failed: ${error.message}`);
    },

    async invalidateToken(token: string, reason: string): Promise<void> {
      const { error } = await db
        .from('user_push_tokens')
        .update({
          is_valid:           false,
          invalidated_at:     new Date().toISOString(),
          invalidated_reason: reason,
        })
        .eq('expo_push_token', token);
      if (error) throw new Error(`invalidate_token_failed: ${error.message}`);
    },
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return errorResponse('method_not_allowed', 405);
  if (!isServiceRole(req))      return errorResponse('unauthorized', 401);

  let body: { limit?: number } = {};
  try { body = await req.json(); } catch { /* body is optional */ }
  const limit = Math.min(Math.max(body.limit ?? 100, 1), 100);

  try {
    const result = await drainOnce({
      db:        makeLiveDb(),
      pushFetch: makeExpoFetch(Deno.env.get('EXPO_ACCESS_TOKEN') || undefined),
      limit,
    });
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(`drain_failed: ${msg}`, 500);
  }
});
