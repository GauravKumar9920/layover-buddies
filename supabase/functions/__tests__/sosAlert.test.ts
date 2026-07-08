// ============================================================================
// SOS ALERT DELIVERY TESTS (Deno)
// ============================================================================
// Covers the pure, fetch-injected delivery helpers: message content, channel
// selection, per-channel failure isolation, and graceful degradation when no
// ops channel is configured. No network or env access.
// ============================================================================

import { assert, assertEquals, assertStringIncludes }
  from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildSosOpsMessage,
  deliverSosAlert,
  mapsLink,
  sosConfigFromEnv,
  type SosContext,
} from '../_shared/sosAlert.ts';

const CTX: SosContext = {
  alertId: 'sos-1',
  bookingId: 'bk-1',
  latitude: 19.076,
  longitude: 72.8777,
  triggeredAt: '2026-07-08T10:00:00Z',
  triggeredByName: 'Aarav Sharma',
  triggeredByRole: 'traveler',
  counterpartName: 'Priya Guide',
  tourName: 'Bandra street food walk',
  city: 'Mumbai',
  startDate: '2026-07-08T09:00:00Z',
};

// ── Message content ──────────────────────────────────────────────────────────

Deno.test('buildSosOpsMessage includes who, counterpart, trip, and a maps link', () => {
  const { subject, text, html } = buildSosOpsMessage(CTX);
  assertStringIncludes(subject, 'Aarav Sharma');
  assertStringIncludes(text, 'Aarav Sharma');
  assertStringIncludes(text, 'traveler');
  assertStringIncludes(text, 'Priya Guide');
  assertStringIncludes(text, 'Bandra street food walk');
  assertStringIncludes(text, mapsLink(19.076, 72.8777));
  assertStringIncludes(text, 'bk-1');
  assertStringIncludes(html, 'Google Maps');
});

Deno.test('buildSosOpsMessage tolerates missing tour/date', () => {
  const { text } = buildSosOpsMessage({ ...CTX, tourName: null, startDate: null });
  assert(!text.includes('undefined'));
  assert(!text.includes('null'));
  assertStringIncludes(text, 'a trip');
});

Deno.test('mapsLink builds a q= google maps url', () => {
  assertEquals(mapsLink(1.5, -2.5), 'https://www.google.com/maps?q=1.5,-2.5');
});

// ── Delivery: fake fetch ─────────────────────────────────────────────────────

function fakeFetch(handler: (url: string, init?: RequestInit) => { status: number }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    const { status } = handler(url, init);
    return Promise.resolve(new Response('', { status }));
  }) as typeof fetch;
  return { fn, calls };
}

Deno.test('deliverSosAlert: skips gracefully when no channel configured', async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 200 }));
  const result = await deliverSosAlert({ ctx: CTX, config: {}, fetchFn: fn });
  assertEquals(result.skipped, 'no_channel_configured');
  assertEquals(result.delivered, []);
  assertEquals(calls.length, 0);
});

Deno.test('deliverSosAlert: posts to the webhook when configured', async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 200 }));
  const result = await deliverSosAlert({
    ctx: CTX,
    config: { webhookUrl: 'https://hooks.example.com/x' },
    fetchFn: fn,
  });
  assertEquals(result.delivered, ['webhook']);
  assertEquals(result.failed, []);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, 'https://hooks.example.com/x');
  // Slack-compatible: a top-level `text` field is present.
  const body = JSON.parse(calls[0].init!.body as string);
  assertStringIncludes(body.text, 'Aarav Sharma');
  assertEquals(body.sos.booking_id, 'bk-1');
});

Deno.test('deliverSosAlert: emails via Resend when key + address present', async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 200 }));
  const result = await deliverSosAlert({
    ctx: CTX,
    config: { resendApiKey: 're_123', alertEmail: 'ops@detourtrips.com' },
    fetchFn: fn,
  });
  assertEquals(result.delivered, ['email']);
  assertEquals(calls[0].url, 'https://api.resend.com/emails');
  const headers = calls[0].init!.headers as Record<string, string>;
  assertStringIncludes(headers.Authorization, 're_123');
  const body = JSON.parse(calls[0].init!.body as string);
  assertEquals(body.to, ['ops@detourtrips.com']);
});

Deno.test('deliverSosAlert: email requires BOTH key and address', async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 200 }));
  const onlyKey = await deliverSosAlert({ ctx: CTX, config: { resendApiKey: 're_1' }, fetchFn: fn });
  assertEquals(onlyKey.skipped, 'no_channel_configured');
  assertEquals(calls.length, 0);
});

Deno.test('deliverSosAlert: delivers to both channels and records both', async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 200 }));
  const result = await deliverSosAlert({
    ctx: CTX,
    config: { webhookUrl: 'https://hooks.example.com/x', resendApiKey: 're_1', alertEmail: 'a@b.com' },
    fetchFn: fn,
  });
  assertEquals(result.delivered.sort(), ['email', 'webhook']);
  assertEquals(calls.length, 2);
});

Deno.test('deliverSosAlert: one channel failing does not suppress the other', async () => {
  const { fn } = fakeFetch((url) => ({ status: url.includes('resend') ? 500 : 200 }));
  const result = await deliverSosAlert({
    ctx: CTX,
    config: { webhookUrl: 'https://hooks.example.com/x', resendApiKey: 're_1', alertEmail: 'a@b.com' },
    fetchFn: fn,
  });
  assertEquals(result.delivered, ['webhook']);
  assertEquals(result.failed.length, 1);
  assertEquals(result.failed[0].channel, 'email');
  assertStringIncludes(result.failed[0].reason, '500');
});

Deno.test('deliverSosAlert: a thrown fetch is captured, not propagated', async () => {
  const throwingFetch = (() => Promise.reject(new Error('network down'))) as typeof fetch;
  const result = await deliverSosAlert({
    ctx: CTX,
    config: { webhookUrl: 'https://hooks.example.com/x' },
    fetchFn: throwingFetch,
  });
  assertEquals(result.delivered, []);
  assertEquals(result.failed[0].channel, 'webhook');
  assertStringIncludes(result.failed[0].reason, 'network down');
});

// ── Config from env ──────────────────────────────────────────────────────────

Deno.test('sosConfigFromEnv reads the documented keys', () => {
  const env = {
    get: (k: string) =>
      ({
        SOS_WEBHOOK_URL: 'https://hook',
        RESEND_API_KEY: 're_x',
        SOS_ALERT_EMAIL: 'ops@x.com',
      } as Record<string, string>)[k],
  };
  const cfg = sosConfigFromEnv(env);
  assertEquals(cfg.webhookUrl, 'https://hook');
  assertEquals(cfg.resendApiKey, 're_x');
  assertEquals(cfg.alertEmail, 'ops@x.com');
  assertEquals(cfg.alertFrom, undefined);
});
