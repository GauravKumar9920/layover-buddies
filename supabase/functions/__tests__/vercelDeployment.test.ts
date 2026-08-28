// ============================================================================
// VERCEL DEPLOYMENT WEBHOOK — signature + payload mapping (Deno)
// ============================================================================
// Run via: deno test --allow-env supabase/functions/__tests__/vercelDeployment.test.ts
//
// Covers the receiving half of the publishing loop described in
// `apps/studio/docs/publishing.md`: Vercel's raw-body HMAC-SHA1 signature and
// the translation from its event types to `content_deployment_status`.
// ============================================================================

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { hmacSha1Hex, verifyVercelSignature } from '../_shared/secretAuth.ts';
import { parseVercelDeploymentEvent } from '../_shared/vercelDeployment.ts';

const SECRET = 'vercel_webhook_secret_value';

function delivery(type: string, extra: Record<string, unknown> = {}): unknown {
  return {
    id: 'evt_HxPbYq3Kj2',
    type,
    createdAt: 1_755_000_000_000,
    payload: {
      target: 'production',
      project: { id: 'prj_marketing' },
      deployment: { id: 'dpl_9aBc7', url: 'detourtrips-abc123.vercel.app' },
      ...extra,
    },
  };
}

// ─── signature ───────────────────────────────────────────────────────────────

Deno.test('verifyVercelSignature — accepts a correct hex SHA-1 digest', async () => {
  const body = JSON.stringify(delivery('deployment.succeeded'));
  assertEquals(await verifyVercelSignature(body, await hmacSha1Hex(body, SECRET), SECRET), true);
});

Deno.test('verifyVercelSignature — rejects a tampered body', async () => {
  const body = JSON.stringify(delivery('deployment.succeeded'));
  const signature = await hmacSha1Hex(body, SECRET);
  assertEquals(await verifyVercelSignature(`${body} `, signature, SECRET), false);
});

Deno.test('verifyVercelSignature — rejects the wrong secret', async () => {
  const body = JSON.stringify(delivery('deployment.succeeded'));
  const signature = await hmacSha1Hex(body, 'a_different_secret_value');
  assertEquals(await verifyVercelSignature(body, signature, SECRET), false);
});

Deno.test('verifyVercelSignature — rejects a missing or malformed signature', async () => {
  const body = JSON.stringify(delivery('deployment.succeeded'));
  assertEquals(await verifyVercelSignature(body, null, SECRET), false);
  assertEquals(await verifyVercelSignature(body, 'not-hex', SECRET), false);
  // A SHA-256 digest is the right character set but the wrong length.
  assertEquals(await verifyVercelSignature(body, 'a'.repeat(64), SECRET), false);
});

Deno.test('verifyVercelSignature — rejects an unconfigured or too-short secret', async () => {
  const body = JSON.stringify(delivery('deployment.succeeded'));
  const signature = await hmacSha1Hex(body, SECRET);
  assertEquals(await verifyVercelSignature(body, signature, undefined), false);
  assertEquals(await verifyVercelSignature(body, signature, 'short'), false);
});

// ─── event mapping ───────────────────────────────────────────────────────────

Deno.test('parseVercelDeploymentEvent — maps each tracked event to its status', () => {
  const cases: Array<[string, string]> = [
    ['deployment.created', 'building'],
    ['deployment.succeeded', 'ready'],
    ['deployment.ready', 'ready'],
    ['deployment.promoted', 'ready'],
    ['deployment.error', 'failed'],
    ['deployment.canceled', 'cancelled'],
  ];
  for (const [type, expected] of cases) {
    const parsed = parseVercelDeploymentEvent(delivery(type));
    assertEquals(parsed.ok, true, `${type} should parse`);
    if (parsed.ok) assertEquals(parsed.value.status, expected);
  }
});

Deno.test('parseVercelDeploymentEvent — ignores untracked event types', () => {
  const parsed = parseVercelDeploymentEvent(delivery('deployment.check-rerequested'));
  assertEquals(parsed.ok, false);
  if (!parsed.ok) assertEquals(parsed.code, 'ignored_event_type');
});

Deno.test('parseVercelDeploymentEvent — namespaces the delivery id so Sanity ids cannot collide', () => {
  const parsed = parseVercelDeploymentEvent(delivery('deployment.succeeded'));
  assertEquals(parsed.ok, true);
  if (parsed.ok) assertEquals(parsed.value.eventId, 'vercel:evt_HxPbYq3Kj2');
});

Deno.test('parseVercelDeploymentEvent — promotes the bare host to an https URL', () => {
  const parsed = parseVercelDeploymentEvent(delivery('deployment.succeeded'));
  assertEquals(parsed.ok, true);
  if (parsed.ok) assertEquals(parsed.value.deploymentUrl, 'https://detourtrips-abc123.vercel.app/');
});

Deno.test('parseVercelDeploymentEvent — a failed event always carries a safe error summary', () => {
  const parsed = parseVercelDeploymentEvent(delivery('deployment.error'));
  assertEquals(parsed.ok, true);
  // `upsert_content_deployment_event_tx` rejects a `failed` row with no error.
  if (parsed.ok) assertEquals(parsed.value.error, 'vercel_deployment.error');
});

Deno.test('parseVercelDeploymentEvent — non-failed events carry no error', () => {
  const parsed = parseVercelDeploymentEvent(delivery('deployment.succeeded'));
  assertEquals(parsed.ok, true);
  if (parsed.ok) assertEquals(parsed.value.error, null);
});

Deno.test('parseVercelDeploymentEvent — surfaces project and target for scoping', () => {
  const parsed = parseVercelDeploymentEvent(delivery('deployment.succeeded', { target: 'preview' }));
  assertEquals(parsed.ok, true);
  if (parsed.ok) {
    assertEquals(parsed.value.projectId, 'prj_marketing');
    assertEquals(parsed.value.target, 'preview');
  }
});

Deno.test('parseVercelDeploymentEvent — rejects payloads with no deployment id', () => {
  const parsed = parseVercelDeploymentEvent({
    id: 'evt_1', type: 'deployment.succeeded', payload: { target: 'production' },
  });
  assertEquals(parsed.ok, false);
  if (!parsed.ok) assertEquals(parsed.code, 'invalid_deployment_id');
});

Deno.test('parseVercelDeploymentEvent — rejects a non-object payload', () => {
  for (const value of [null, 'string', 42, []]) {
    assertEquals(parseVercelDeploymentEvent(value).ok, false);
  }
});
