import {
  assert,
  assertEquals,
  assertFalse,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  ADMIN_OPERATIONS,
  ADMIN_OPERATION_RULES,
  decodeCursor,
  encodeCursor,
  operationAllowedForRole,
  parseAdminRequest,
  parseListPayload,
} from '../_shared/adminContract.ts';
import { parseDeploymentStatus, parseSanityPublish } from '../_shared/contentDeployment.ts';
import { parseGrowthRequest } from '../_shared/growthReports.ts';
import { normalizeLandingPage, validateLeadSubmission } from '../_shared/leadValidation.ts';
import { verifySanitySignature } from '../_shared/secretAuth.ts';

Deno.test('admin contract has one AAL1 bootstrap and no arbitrary query operation', () => {
  assertEquals(ADMIN_OPERATION_RULES['session.get'].aal2, false);
  for (const operation of ADMIN_OPERATIONS.filter((name) => name !== 'session.get')) {
    assertEquals(ADMIN_OPERATION_RULES[operation].aal2, true, `${operation} must require AAL2`);
  }
  assertFalse(ADMIN_OPERATIONS.some((operation) => /raw|table|sql|query/.test(operation)));
  assertEquals(parseAdminRequest({ operation: 'table.query', payload: {} }), {
    ok: false,
    code: 'unsupported_operation',
    message: 'The requested admin operation is not supported.',
  });
});

Deno.test('RBAC keeps money, safety and audit responsibilities separated', () => {
  assert(operationAllowedForRole('finance.summary', 'finance'));
  assertFalse(operationAllowedForRole('finance.summary', 'operations'));
  assert(operationAllowedForRole('sos.transition', 'operations'));
  assertFalse(operationAllowedForRole('sos.transition', 'growth'));
  assert(operationAllowedForRole('audit.list', 'owner'));
  assertFalse(operationAllowedForRole('audit.list', 'finance'));
});

Deno.test('pagination cursor round-trips and server page sizes stay bounded', () => {
  assertEquals(decodeCursor(encodeCursor(125)), 125);
  assertEquals(parseListPayload({ pageSize: 101 }).ok, false);
  assertEquals(parseListPayload({ pageSize: 100 }).ok, true);
});

Deno.test('growth reports use an equal previous period and reject unbounded ranges', () => {
  const parsed = parseGrowthRequest({
    report: 'overview',
    startDate: '2026-07-01',
    endDate: '2026-07-28',
  });
  assert(parsed.ok);
  assertEquals(parsed.value.range.days, 28);
  assertEquals(parsed.value.range.previousStartDate, '2026-06-03');
  assertEquals(parsed.value.range.previousEndDate, '2026-06-30');
  assertEquals(parseGrowthRequest({
    report: 'overview',
    startDate: '2025-01-01',
    endDate: '2026-01-02',
  }).ok, false);
});

Deno.test('lead validation keeps bounded first-party attribution and removes URL queries', () => {
  const parsed = validateLeadSubmission({
    requestType: 'detour',
    contact: { name: 'Mina', email: 'MINA@example.com' },
    layover: { arrival: '09:00', departure: '18:00', flightNumbers: 'AI 101' },
    landingPage: 'https://detourtrips.com/guides/8-hour-layover-mumbai?utm_source=search#plan',
    firstAttribution: {
      utm_source: 'search',
      attribution_referrer: 'https://www.google.com/search?q=mumbai+layover',
    },
    lastAttribution: {},
  });
  assert(parsed.ok);
  assertEquals(parsed.value.contact.email, 'mina@example.com');
  assertEquals(parsed.value.landingPage, '/guides/8-hour-layover-mumbai');
  assertEquals(parsed.value.firstAttribution.attribution_referrer, 'https://www.google.com');
  assertEquals(normalizeLandingPage('https://attacker.example/collect'), null);
});

Deno.test('lead validation rejects missing Detour fields and foreign landing pages', () => {
  assertEquals(validateLeadSubmission({
    requestType: 'detour',
    contact: { email: 'mina@example.com' },
    layover: {},
    landingPage: '/',
  }).ok, false);
  assertEquals(validateLeadSubmission({
    requestType: 'cheat_sheet',
    contact: { email: 'mina@example.com' },
    landingPage: 'https://attacker.example/collect',
  }).ok, false);
});

Deno.test('publishing accepts only published bounded Sanity documents', () => {
  assertEquals(parseSanityPublish({
    _id: 'drafts.guide-1',
    _rev: 'rev-1',
    _type: 'guide',
    slug: { current: 'mumbai-at-night' },
  }).ok, false);
  const parsed = parseSanityPublish({
    _id: 'guide-1',
    _rev: 'rev-1',
    _type: 'guide',
    slug: { current: 'mumbai-at-night' },
    _updatedAt: '2026-08-08T00:00:00.000Z',
  });
  assert(parsed.ok);
  assertEquals(parsed.value.path, '/guides/mumbai-at-night');
});

Deno.test('deployment callbacks require HTTPS and actionable failure details', () => {
  const base = {
    eventId: 'vercel:build:123',
    deploymentId: '11111111-1111-4111-8111-111111111111',
    documentId: 'guide-1',
  };
  assertEquals(parseDeploymentStatus({ ...base, status: 'ready', productionUrl: 'http://example.com' }).ok, false);
  assertEquals(parseDeploymentStatus({ ...base, status: 'failed' }).ok, false);
  assertEquals(parseDeploymentStatus({
    ...base,
    status: 'ready',
    productionUrl: 'https://detourtrips.com/guides/mumbai-at-night',
  }).ok, true);
});

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

Deno.test('Sanity webhook signatures bind timestamp and raw body', async () => {
  const body = JSON.stringify({ _id: 'guide-1', _rev: 'rev-1', _type: 'guide' });
  const secret = 'detour-sanity-webhook-secret-for-tests';
  const timestamp = 1_800_000_000_000;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const signature = `t=${timestamp},v1=${base64Url(new Uint8Array(digest))}`;
  assert(await verifySanitySignature(body, signature, secret, timestamp));
  assertFalse(await verifySanitySignature(`${body} `, signature, secret, timestamp));
  assertFalse(await verifySanitySignature(body, signature, secret, timestamp + 3_600_001));
});
