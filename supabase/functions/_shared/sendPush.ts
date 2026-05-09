// ============================================================================
// SEND-PUSH CORE — Phase 5
// ============================================================================
// Pure orchestration module that drains pending notification rows and pushes
// them to the Expo Push API.  The real Edge handler in send-push/index.ts
// wires the live Supabase client + global fetch; this file is structured so
// the same drainOnce() function can be unit-tested with an in-memory DB and
// a mocked fetch.
// ============================================================================

import { pushTitleFor, pushBodyFor, deepLinkFor } from './pushCopy.ts';

// ── Public types ────────────────────────────────────────────────────────────

export interface NotificationRow {
  id:                  string;
  booking_id:          string | null;
  recipient_user_id:   string;
  kind:                string;
  payload:             Record<string, unknown> | null;
  deep_link:           string | null;
}

export interface PushTokenRow {
  user_id:         string;
  expo_push_token: string;
}

/** Minimal DB surface used by drainOnce. Mirrors the supabase-js subset we need. */
export interface DbLike {
  fetchPendingNotifications(limit: number): Promise<NotificationRow[]>;
  fetchValidTokensFor(userIds: string[]): Promise<PushTokenRow[]>;
  markNotificationSent(id: string): Promise<void>;
  markNotificationFailed(id: string, reason: string): Promise<void>;
  invalidateToken(token: string, reason: string): Promise<void>;
}

/** Single message in the Expo Push API request body. */
export interface ExpoPushMessage {
  to:        string;
  title:     string;
  body:      string;
  data:      Record<string, unknown>;
  priority:  'high' | 'default';
  channelId?: string;
  ttl?:       number;
}

/** Subset of the Expo Push API ticket response we care about. */
export interface ExpoPushTicket {
  status:  'ok' | 'error';
  id?:     string;
  message?: string;
  details?: { error?: string; [k: string]: unknown };
}

/** Function signature for posting messages — abstracted so tests can mock it. */
export type PushFetch = (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;

export interface DrainResult {
  scanned:            number;   // notification rows examined
  sent:               number;   // notifications successfully delivered
  failed:             number;   // notifications marked push_failed_at
  skipped_no_tokens:  number;   // recipient has no valid token (left pending)
  invalidated_tokens: number;   // tokens flipped is_valid=false
}

// ── Compose ────────────────────────────────────────────────────────────────

/** Build the Expo Push payload for a single (notification, token) pair. */
export function composeMessage(
  notif: NotificationRow,
  token: string,
): ExpoPushMessage {
  const fallbackLink = deepLinkFor(notif.kind, notif.booking_id);
  const link = notif.deep_link && notif.deep_link.length > 0 ? notif.deep_link : fallbackLink;
  const data: Record<string, unknown> = {
    notification_id: notif.id,
    booking_id:      notif.booking_id,
    kind:            notif.kind,
  };
  if (link) data.deep_link = link;

  return {
    to:        token,
    title:     pushTitleFor(notif.kind),
    body:      pushBodyFor(notif.kind, notif.payload),
    data,
    priority:  'high',
    channelId: 'default',
    // Reminders, late-fee alerts, top-up requests are time-sensitive — drop
    // them after 1h rather than buzz the user about a stale state.
    ttl:       3600,
  };
}

// ── Drain ──────────────────────────────────────────────────────────────────

/**
 * Pull up to `limit` pending notifications, post them to Expo, persist outcomes.
 *
 * Behaviour:
 * - Notifications with no valid recipient token are LEFT pending (skipped).
 *   They will be picked up on a future run after the user installs the app.
 * - When multiple devices are registered for one recipient, every device gets
 *   the message; the notification is marked sent if AT LEAST ONE delivery
 *   ticket comes back ok.
 * - Tokens that return DeviceNotRegistered are flipped is_valid=false.
 * - Other ticket errors mark the notification push_failed_at; the cron will
 *   no longer re-try (failed rows are out of the polling index).
 */
export async function drainOnce(params: {
  db:         DbLike;
  pushFetch:  PushFetch;
  limit:      number;
}): Promise<DrainResult> {
  const { db, pushFetch, limit } = params;

  const notifications = await db.fetchPendingNotifications(limit);
  if (notifications.length === 0) {
    return { scanned: 0, sent: 0, failed: 0, skipped_no_tokens: 0, invalidated_tokens: 0 };
  }

  // Fetch all valid tokens for the recipients in this batch.
  const recipientIds = Array.from(new Set(notifications.map((n) => n.recipient_user_id)));
  const tokenRows = await db.fetchValidTokensFor(recipientIds);

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows) {
    const existing = tokensByUser.get(row.user_id) ?? [];
    existing.push(row.expo_push_token);
    tokensByUser.set(row.user_id, existing);
  }

  // Build the message batch — one message per (notification, token).
  // Track which notification each message belongs to so we can persist results.
  interface Pending {
    notification: NotificationRow;
    tokens:       string[];
  }
  const pending: Pending[] = [];
  let skipped = 0;

  for (const n of notifications) {
    const tokens = tokensByUser.get(n.recipient_user_id) ?? [];
    if (tokens.length === 0) {
      skipped++;
      continue;
    }
    pending.push({ notification: n, tokens });
  }

  if (pending.length === 0) {
    return { scanned: notifications.length, sent: 0, failed: 0, skipped_no_tokens: skipped, invalidated_tokens: 0 };
  }

  // Flatten to a single Expo POST.  Expo accepts up to 100 per request; our
  // cron cap is 100 notifications × ~1 token each, well under the limit.
  interface FlatEntry { notifIndex: number; token: string; message: ExpoPushMessage; }
  const flat: FlatEntry[] = [];
  pending.forEach((p, notifIndex) => {
    for (const tk of p.tokens) {
      flat.push({ notifIndex, token: tk, message: composeMessage(p.notification, tk) });
    }
  });

  let tickets: ExpoPushTicket[];
  try {
    tickets = await pushFetch(flat.map((f) => f.message));
  } catch (err) {
    // Network/server failure: mark every targeted notification as failed.
    const reason = `expo_fetch_failed: ${err instanceof Error ? err.message : String(err)}`;
    for (const p of pending) {
      await db.markNotificationFailed(p.notification.id, reason);
    }
    return {
      scanned:            notifications.length,
      sent:               0,
      failed:             pending.length,
      skipped_no_tokens:  skipped,
      invalidated_tokens: 0,
    };
  }

  if (tickets.length !== flat.length) {
    // Defensive: Expo should return one ticket per message.  If it doesn't, we
    // can't reliably correlate outcomes, so mark everything failed and bail.
    const reason = `ticket_count_mismatch: expected ${flat.length}, got ${tickets.length}`;
    for (const p of pending) {
      await db.markNotificationFailed(p.notification.id, reason);
    }
    return {
      scanned:            notifications.length,
      sent:               0,
      failed:             pending.length,
      skipped_no_tokens:  skipped,
      invalidated_tokens: 0,
    };
  }

  // Walk tickets and bucket by notification.
  const perNotif: Array<{ ok: boolean; lastError?: string }> = pending.map(() => ({ ok: false }));
  let invalidatedTokens = 0;
  const invalidatedSet = new Set<string>();

  for (let i = 0; i < flat.length; i++) {
    const entry  = flat[i];
    const ticket = tickets[i];

    if (ticket.status === 'ok') {
      perNotif[entry.notifIndex].ok = true;
      continue;
    }

    const errCode = ticket.details?.error ?? ticket.message ?? 'unknown_error';
    perNotif[entry.notifIndex].lastError = String(errCode);

    if (errCode === 'DeviceNotRegistered' && !invalidatedSet.has(entry.token)) {
      invalidatedSet.add(entry.token);
      await db.invalidateToken(entry.token, 'DeviceNotRegistered');
      invalidatedTokens++;
    }
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i++) {
    const result = perNotif[i];
    const notif  = pending[i].notification;
    if (result.ok) {
      await db.markNotificationSent(notif.id);
      sent++;
    } else {
      await db.markNotificationFailed(notif.id, result.lastError ?? 'unknown_error');
      failed++;
    }
  }

  return {
    scanned:            notifications.length,
    sent,
    failed,
    skipped_no_tokens:  skipped,
    invalidated_tokens: invalidatedTokens,
  };
}

// ── Live HTTP push fetch ───────────────────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Build the live PushFetch implementation that POSTs to Expo Push API.
 * Pass an optional access token for production rate-limit grants.
 */
export function makeExpoFetch(accessToken?: string): PushFetch {
  return async (messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> => {
    const headers: Record<string, string> = {
      'Accept':         'application/json',
      'Accept-Encoding':'gzip, deflate',
      'Content-Type':   'application/json',
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers,
      body:    JSON.stringify(messages),
    });
    if (!res.ok) {
      throw new Error(`expo_push_http_${res.status}`);
    }
    const json = await res.json() as { data: ExpoPushTicket[] | ExpoPushTicket };
    // Expo returns { data: [ticket, ticket, ...] } for batched calls.
    return Array.isArray(json.data) ? json.data : [json.data];
  };
}
