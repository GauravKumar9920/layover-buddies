// ============================================================================
// WEBHOOK SIGNATURE TESTS — Phase 2 (Deno)
// ============================================================================
// Run via: deno test --allow-env supabase/functions/__tests__/webhook-signature.test.ts
//
// Exercises the HMAC-SHA256 verification logic extracted into:
//   supabase/functions/_shared/razorpaySignature.ts
//
// Reference: https://razorpay.com/docs/webhooks/validate-test/
// The Razorpay docs give: HMAC_SHA256_HEX(secret, rawBody) === signature.
// ============================================================================

import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  verifyRazorpaySignature,
  hmacSha256Hex,
  timingSafeEqual,
} from '../_shared/razorpaySignature.ts';

const KNOWN_SECRET  = 'webhooksecret123';
const KNOWN_BODY    = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_abc","amount":50000}}}}';

// Pre-compute the expected HMAC for use in tests below.
// We compute it once in top-level scope so all tests share the same reference.
let KNOWN_SIG: string;

// Deno top-level await is available in tests; compute reference sig before tests run.
KNOWN_SIG = await hmacSha256Hex(KNOWN_SECRET, KNOWN_BODY);

// ─── hmacSha256Hex ───────────────────────────────────────────────────────────

Deno.test('hmacSha256Hex — returns a 64-char hex string', async () => {
  const sig = await hmacSha256Hex(KNOWN_SECRET, KNOWN_BODY);
  assertEquals(sig.length, 64);
  assertEquals(/^[0-9a-f]+$/.test(sig), true);
});

Deno.test('hmacSha256Hex — deterministic: same inputs produce same digest', async () => {
  const a = await hmacSha256Hex(KNOWN_SECRET, KNOWN_BODY);
  const b = await hmacSha256Hex(KNOWN_SECRET, KNOWN_BODY);
  assertEquals(a, b);
});

Deno.test('hmacSha256Hex — different body produces different digest', async () => {
  const a = await hmacSha256Hex(KNOWN_SECRET, KNOWN_BODY);
  const b = await hmacSha256Hex(KNOWN_SECRET, KNOWN_BODY + ' ');
  assertNotEquals(a, b);
});

Deno.test('hmacSha256Hex — different secret produces different digest', async () => {
  const a = await hmacSha256Hex(KNOWN_SECRET, KNOWN_BODY);
  const b = await hmacSha256Hex('different_secret', KNOWN_BODY);
  assertNotEquals(a, b);
});

// ─── timingSafeEqual ─────────────────────────────────────────────────────────

Deno.test('timingSafeEqual — equal strings return true', () => {
  assertEquals(timingSafeEqual('abc', 'abc'), true);
});

Deno.test('timingSafeEqual — different strings return false', () => {
  assertEquals(timingSafeEqual('abc', 'xyz'), false);
});

Deno.test('timingSafeEqual — different lengths return false immediately', () => {
  assertEquals(timingSafeEqual('abc', 'abcd'), false);
});

Deno.test('timingSafeEqual — single-byte difference returns false', () => {
  const a = '0'.repeat(64);
  const b = '0'.repeat(63) + '1';
  assertEquals(timingSafeEqual(a, b), false);
});

// ─── verifyRazorpaySignature ─────────────────────────────────────────────────

Deno.test('verifyRazorpaySignature — correct signature returns true', async () => {
  const result = await verifyRazorpaySignature(KNOWN_BODY, KNOWN_SIG, KNOWN_SECRET);
  assertEquals(result, true);
});

Deno.test('verifyRazorpaySignature — wrong signature returns false', async () => {
  const wrongSig = '0'.repeat(64);
  const result = await verifyRazorpaySignature(KNOWN_BODY, wrongSig, KNOWN_SECRET);
  assertEquals(result, false);
});

Deno.test('verifyRazorpaySignature — null signature header returns false', async () => {
  const result = await verifyRazorpaySignature(KNOWN_BODY, null, KNOWN_SECRET);
  assertEquals(result, false);
});

Deno.test('verifyRazorpaySignature — empty string signature returns false', async () => {
  const result = await verifyRazorpaySignature(KNOWN_BODY, '', KNOWN_SECRET);
  assertEquals(result, false);
});

Deno.test('verifyRazorpaySignature — tampered body (one byte changed) returns false', async () => {
  const tamperedBody = KNOWN_BODY.slice(0, -1) + 'X';
  const result = await verifyRazorpaySignature(tamperedBody, KNOWN_SIG, KNOWN_SECRET);
  assertEquals(result, false);
});

Deno.test('verifyRazorpaySignature — correct signature but wrong secret returns false', async () => {
  // sig was computed with KNOWN_SECRET; wrong secret should fail
  const result = await verifyRazorpaySignature(KNOWN_BODY, KNOWN_SIG, 'wrong_secret');
  assertEquals(result, false);
});

Deno.test('verifyRazorpaySignature — empty body with matching HMAC returns true', async () => {
  const emptyBody = '';
  const sig = await hmacSha256Hex(KNOWN_SECRET, emptyBody);
  const result = await verifyRazorpaySignature(emptyBody, sig, KNOWN_SECRET);
  assertEquals(result, true);
});
