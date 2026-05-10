// ============================================================================
// PUSH COPY TESTS — Phase 5 (Deno)
// ============================================================================
// Run via: deno test --allow-env supabase/functions/__tests__/pushCopy.test.ts
// ============================================================================

import { assert, assertEquals, assertStringIncludes }
  from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { pushTitleFor, pushBodyFor, deepLinkFor } from '../_shared/pushCopy.ts';

const KINDS = [
  'balance_reminder_84h',
  'balance_reminder_48h',
  'balance_reminder_24h',
  'balance_reminder_18h',
  'late_fee_assessed',
  'no_pay_cancelled',
  'proofs_overdue',
  'rating_link',
  'top_up_request',
];

// ── Title ──────────────────────────────────────────────────────────────────

Deno.test('pushTitleFor returns a non-empty string for every known kind', () => {
  for (const kind of KINDS) {
    const title = pushTitleFor(kind);
    assert(title.length > 0, `title empty for ${kind}`);
    assert(title.length <= 80, `title too long for ${kind}: ${title}`);
  }
});

Deno.test('pushTitleFor falls back gracefully for unknown kinds', () => {
  assertEquals(pushTitleFor('completely_unknown_kind'), 'Mumbai Buddies');
});

// ── Body ───────────────────────────────────────────────────────────────────

Deno.test('pushBodyFor: balance_reminder_24h includes "24h"', () => {
  const body = pushBodyFor('balance_reminder_24h', { hours_until_trip: 24 });
  assertStringIncludes(body, '24h');
});

Deno.test('pushBodyFor: balance_reminder fractional hours rendered as minutes', () => {
  const body = pushBodyFor('balance_reminder_18h', { hours_until_trip: 0.5 });
  assertStringIncludes(body, '30m');
});

Deno.test('pushBodyFor: balance_reminder without payload still works', () => {
  const body = pushBodyFor('balance_reminder_24h', null);
  assert(body.length > 0);
  // Should not throw and should not include "undefined" or "NaN"
  assert(!body.includes('undefined'));
  assert(!body.includes('NaN'));
});

Deno.test('pushBodyFor: late_fee_assessed renders ₹ amount', () => {
  const body = pushBodyFor('late_fee_assessed', { late_fee_paise: 100000 });
  assertStringIncludes(body, '₹1,000');
});

Deno.test('pushBodyFor: late_fee_assessed default fee when missing', () => {
  const body = pushBodyFor('late_fee_assessed', {});
  assertStringIncludes(body, '₹1,000');
});

Deno.test('pushBodyFor: top_up_request includes purpose + amount', () => {
  const body = pushBodyFor('top_up_request', {
    purpose: 'Extra meals',
    requested_paise: 50000,
  });
  assertStringIncludes(body, 'Extra meals');
  assertStringIncludes(body, '₹500');
});

Deno.test('pushBodyFor: top_up_request without amount still names purpose', () => {
  const body = pushBodyFor('top_up_request', { purpose: 'Souvenirs' });
  assertStringIncludes(body, 'Souvenirs');
});

Deno.test('pushBodyFor: proofs_overdue body is informative', () => {
  const body = pushBodyFor('proofs_overdue', {});
  assertStringIncludes(body, 'proofs');
});

Deno.test('pushBodyFor: rating prompt body mentions rating', () => {
  const body = pushBodyFor('rating_link', {});
  assertStringIncludes(body, 'rate');
});

Deno.test('pushBodyFor: unknown kind falls back to generic body', () => {
  const body = pushBodyFor('completely_unknown_kind', { foo: 'bar' });
  assertEquals(body, 'You have a new notification.');
});

// ── Deep link ──────────────────────────────────────────────────────────────

Deno.test('deepLinkFor: balance reminder routes to /trips/balance', () => {
  const bookingId = '11111111-1111-1111-1111-111111111111';
  for (const kind of [
    'balance_reminder_84h', 'balance_reminder_48h',
    'balance_reminder_24h', 'balance_reminder_18h', 'late_fee_assessed',
  ]) {
    assertEquals(deepLinkFor(kind, bookingId), `/trips/balance/${bookingId}`);
  }
});

Deno.test('deepLinkFor: top_up_request routes to live trip screen', () => {
  assertEquals(
    deepLinkFor('top_up_request', 'b1'),
    '/trips/live/b1',
  );
});

Deno.test('deepLinkFor: rating_link routes to review screen', () => {
  assertEquals(
    deepLinkFor('rating_link', 'b2'),
    '/trips/review/b2',
  );
  assertEquals(
    deepLinkFor('rating_prompt', 'b2'),
    '/trips/review/b2',
  );
});

Deno.test('deepLinkFor: proofs_overdue routes to upload-proofs', () => {
  assertEquals(
    deepLinkFor('proofs_overdue', 'b3'),
    '/bookings/upload-proofs/b3',
  );
});

Deno.test('deepLinkFor: returns empty string when bookingId missing', () => {
  assertEquals(deepLinkFor('balance_reminder_24h', null), '');
  assertEquals(deepLinkFor('balance_reminder_24h', undefined), '');
});

Deno.test('deepLinkFor: unknown kind falls back to /trips/<id>', () => {
  assertEquals(deepLinkFor('mystery_kind', 'b4'), '/trips/b4');
});
