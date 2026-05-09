// ============================================================================
// SEND-PUSH FLOW TESTS — Phase 5 (Deno)
// ============================================================================
// Exercises drainOnce / composeMessage from _shared/sendPush.ts using a fully
// in-memory DbLike + a stub PushFetch so no real network calls happen.
// ============================================================================

import { assert, assertEquals, assertStringIncludes }
  from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  drainOnce,
  composeMessage,
  type DbLike,
  type NotificationRow,
  type PushTokenRow,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from '../_shared/sendPush.ts';

// ─── In-memory DB ────────────────────────────────────────────────────────────

interface State {
  notifications: NotificationRow[];
  // Per-notification mutation state:
  notifPushSent:    Map<string, boolean>;
  notifPushFailed:  Map<string, string>;
  tokens:           PushTokenRow[];
  tokenInvalidated: Map<string, string>; // token → reason
}

function makeDb(state: State): DbLike {
  return {
    async fetchPendingNotifications(limit: number) {
      return state.notifications
        .filter((n) =>
          !state.notifPushSent.get(n.id) &&
          !state.notifPushFailed.has(n.id) &&
          n.recipient_user_id !== null,
        )
        .slice(0, limit);
    },
    async fetchValidTokensFor(userIds: string[]) {
      const set = new Set(userIds);
      return state.tokens.filter((t) =>
        set.has(t.user_id) && !state.tokenInvalidated.has(t.expo_push_token),
      );
    },
    async markNotificationSent(id: string) {
      state.notifPushSent.set(id, true);
    },
    async markNotificationFailed(id: string, reason: string) {
      state.notifPushFailed.set(id, reason);
    },
    async invalidateToken(token: string, reason: string) {
      state.tokenInvalidated.set(token, reason);
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function notif(id: string, kind: string, recipient: string, bookingId: string | null = null): NotificationRow {
  return {
    id,
    booking_id:        bookingId,
    recipient_user_id: recipient,
    kind,
    payload:           {},
    deep_link:         null,
  };
}

function ok(): ExpoPushTicket { return { status: 'ok', id: 'ticket-' + Math.random() }; }
function deviceNotRegistered(): ExpoPushTicket {
  return { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } };
}
function genericError(message = 'MessageRateExceeded'): ExpoPushTicket {
  return { status: 'error', message, details: { error: message } };
}

function emptyState(): State {
  return {
    notifications:    [],
    notifPushSent:    new Map(),
    notifPushFailed:  new Map(),
    tokens:           [],
    tokenInvalidated: new Map(),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

Deno.test('drainOnce: empty queue returns zero counts', async () => {
  const state = emptyState();
  const result = await drainOnce({
    db:        makeDb(state),
    pushFetch: async () => [],
    limit:     100,
  });
  assertEquals(result, { scanned: 0, sent: 0, failed: 0, skipped_no_tokens: 0, invalidated_tokens: 0 });
});

Deno.test('drainOnce: notification with valid token is sent', async () => {
  const state = emptyState();
  state.notifications = [notif('n1', 'balance_reminder_24h', 'u1', 'b1')];
  state.tokens        = [{ user_id: 'u1', expo_push_token: 'ExpoPushToken[abc]' }];

  let captured: ExpoPushMessage[] = [];
  const result = await drainOnce({
    db: makeDb(state),
    pushFetch: async (msgs) => { captured = msgs; return msgs.map(() => ok()); },
    limit: 100,
  });

  assertEquals(result.scanned, 1);
  assertEquals(result.sent, 1);
  assertEquals(result.failed, 0);
  assertEquals(state.notifPushSent.get('n1'), true);
  assertEquals(captured.length, 1);
  assertEquals(captured[0].to, 'ExpoPushToken[abc]');
  assertStringIncludes(captured[0].title, 'balance');
});

Deno.test('drainOnce: notification with no valid tokens is skipped (left pending)', async () => {
  const state = emptyState();
  state.notifications = [notif('n1', 'rating_link', 'u_no_device', 'b1')];
  // No tokens for u_no_device.

  const result = await drainOnce({
    db:        makeDb(state),
    pushFetch: async () => [],
    limit:     100,
  });

  assertEquals(result.scanned, 1);
  assertEquals(result.sent, 0);
  assertEquals(result.failed, 0);
  assertEquals(result.skipped_no_tokens, 1);
  // The notification stays pending — no push_sent_at, no push_failed_at.
  assert(!state.notifPushSent.has('n1'));
  assert(!state.notifPushFailed.has('n1'));
});

Deno.test('drainOnce: DeviceNotRegistered → token invalidated and notification fails', async () => {
  const state = emptyState();
  state.notifications = [notif('n1', 'balance_reminder_24h', 'u1', 'b1')];
  state.tokens        = [{ user_id: 'u1', expo_push_token: 'ExpoPushToken[stale]' }];

  const result = await drainOnce({
    db:        makeDb(state),
    pushFetch: async () => [deviceNotRegistered()],
    limit:     100,
  });

  assertEquals(result.invalidated_tokens, 1);
  assertEquals(state.tokenInvalidated.get('ExpoPushToken[stale]'), 'DeviceNotRegistered');
  assertEquals(result.failed, 1);
  assertEquals(state.notifPushFailed.get('n1'), 'DeviceNotRegistered');
});

Deno.test('drainOnce: generic Expo error marks notification failed but token stays valid', async () => {
  const state = emptyState();
  state.notifications = [notif('n1', 'top_up_request', 'u1', 'b1')];
  state.tokens        = [{ user_id: 'u1', expo_push_token: 'ExpoPushToken[good]' }];

  const result = await drainOnce({
    db:        makeDb(state),
    pushFetch: async () => [genericError('MessageRateExceeded')],
    limit:     100,
  });

  assertEquals(result.invalidated_tokens, 0);
  assertEquals(result.failed, 1);
  assert(!state.tokenInvalidated.has('ExpoPushToken[good]'));
  assertEquals(state.notifPushFailed.get('n1'), 'MessageRateExceeded');
});

Deno.test('drainOnce: multi-device user — at-least-one-success marks sent', async () => {
  const state = emptyState();
  state.notifications = [notif('n1', 'rating_link', 'u1', 'b1')];
  state.tokens        = [
    { user_id: 'u1', expo_push_token: 'ExpoPushToken[phone]' },
    { user_id: 'u1', expo_push_token: 'ExpoPushToken[tablet-stale]' },
  ];

  const result = await drainOnce({
    db: makeDb(state),
    pushFetch: async () => [ok(), deviceNotRegistered()],
    limit: 100,
  });

  // Notification is sent because phone delivery succeeded.
  assertEquals(result.sent, 1);
  assertEquals(result.failed, 0);
  // Stale token gets invalidated.
  assertEquals(result.invalidated_tokens, 1);
  assertEquals(state.tokenInvalidated.get('ExpoPushToken[tablet-stale]'), 'DeviceNotRegistered');
});

Deno.test('drainOnce: pushFetch network failure → all targeted notifications marked failed', async () => {
  const state = emptyState();
  state.notifications = [
    notif('n1', 'balance_reminder_24h', 'u1', 'b1'),
    notif('n2', 'rating_link',          'u1', 'b2'),
  ];
  state.tokens = [{ user_id: 'u1', expo_push_token: 'ExpoPushToken[abc]' }];

  const result = await drainOnce({
    db:        makeDb(state),
    pushFetch: async () => { throw new Error('socket reset'); },
    limit:     100,
  });

  assertEquals(result.sent, 0);
  assertEquals(result.failed, 2);
  assertStringIncludes(state.notifPushFailed.get('n1') ?? '', 'expo_fetch_failed');
  assertStringIncludes(state.notifPushFailed.get('n2') ?? '', 'socket reset');
});

Deno.test('drainOnce: limit caps batch size', async () => {
  const state = emptyState();
  for (let i = 0; i < 5; i++) {
    state.notifications.push(notif(`n${i}`, 'balance_reminder_24h', 'u1', `b${i}`));
  }
  state.tokens = [{ user_id: 'u1', expo_push_token: 'ExpoPushToken[abc]' }];

  let captured: ExpoPushMessage[] = [];
  const result = await drainOnce({
    db: makeDb(state),
    pushFetch: async (msgs) => { captured = msgs; return msgs.map(() => ok()); },
    limit: 3,
  });

  assertEquals(result.scanned, 3);
  assertEquals(result.sent, 3);
  assertEquals(captured.length, 3);
  // Two notifications remain pending for the next run.
  assert(!state.notifPushSent.has('n3'));
  assert(!state.notifPushSent.has('n4'));
});

// ─── composeMessage ─────────────────────────────────────────────────────────

Deno.test('composeMessage: stores notification_id, kind, deep_link in data', () => {
  const n = notif('n1', 'balance_reminder_24h', 'u1', 'b1');
  const msg = composeMessage(n, 'ExpoPushToken[abc]');
  assertEquals(msg.data.notification_id, 'n1');
  assertEquals(msg.data.kind, 'balance_reminder_24h');
  assertEquals(msg.data.booking_id, 'b1');
  assertEquals(msg.data.deep_link, '/trips/balance/b1');
  assertEquals(msg.priority, 'high');
  assertEquals(msg.channelId, 'default');
  assertEquals(msg.ttl, 3600);
});

Deno.test('composeMessage: explicit deep_link wins over fallback', () => {
  const n: NotificationRow = {
    id: 'n2', booking_id: 'b1', recipient_user_id: 'u1',
    kind: 'balance_reminder_24h',
    payload: {},
    deep_link: '/custom/path',
  };
  const msg = composeMessage(n, 'tk');
  assertEquals(msg.data.deep_link, '/custom/path');
});

Deno.test('composeMessage: empty deep_link omitted from data', () => {
  const n: NotificationRow = {
    id: 'n3', booking_id: null, recipient_user_id: 'u1',
    kind: 'mystery_kind', payload: {}, deep_link: null,
  };
  const msg = composeMessage(n, 'tk');
  assertEquals(msg.data.deep_link, undefined);
});
