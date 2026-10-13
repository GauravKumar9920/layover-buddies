// ============================================================================
// DEPOSIT CAPTURE FLOW TESTS — Phase 2 (Deno)
// ============================================================================
// Run via: deno test --allow-env supabase/functions/__tests__/depositCaptureFlow.test.ts
//
// Exercises handleDepositCaptured / handleDepositFailed from:
//   supabase/functions/_shared/depositCapture.ts
//
// The Supabase client is replaced with a lightweight in-memory mock that
// faithfully implements the subset of the supabase-js API used by the module.
// ============================================================================

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  handleDepositCaptured,
  handleDepositFailed,
  type CapturedPayload,
  type FailedPayload,
} from '../_shared/depositCapture.ts';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory DB mock
// ─────────────────────────────────────────────────────────────────────────────

interface DbState {
  bookings:       Map<string, { id: string; status: string }>;
  deposits:       Map<string, { id: string; booking_id: string; side: string; status: string; razorpay_payment_id?: string; held_at?: string }>;
  payment_events: Map<string, { id: string; razorpay_order_id: string; razorpay_payment_id?: string; status: string; razorpay_signature?: string; captured_at?: string; failed_reason?: string }>;
}

/**
 * Build a mock Supabase-like client backed by the given in-memory state.
 * This deliberately mirrors only the query shapes used by depositCapture.ts.
 */
function makeDb(state: DbState, beforeUpdate?: (table: string, patch: Record<string, unknown>) => void) {
  return {
    from(table: 'bookings' | 'deposits' | 'payment_events') {
      const store = state[table] as Map<string, any>;
      const filters: ((row: any) => boolean)[] = [];
      let patch: Record<string, unknown> | null = null;
      let single = false;
      const query = {
        select(_columns: string) { return query; },
        update(value: Record<string, unknown>) { patch = value; return query; },
        eq(key: string, value: string) { filters.push((row) => row[key] === value); return query; },
        in(key: string, values: string[]) { filters.push((row) => values.includes(row[key])); return query; },
        maybeSingle() { single = true; return query; },
        then(resolve: (result: any) => void) {
          if (patch) beforeUpdate?.(table, patch);
          const rows = [...store.values()].filter((row) => filters.every((filter) => filter(row)));
          if (patch) rows.forEach((row) => Object.assign(row, patch));
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}

// ─── Fixture helpers ─────────────────────────────────────────────────────────

const BOOKING_ID  = 'booking-001';
const ORDER_T     = 'order-traveler-001';
const ORDER_B     = 'order-buddy-001';
const PAYMENT_T   = 'pay_traveler_001';
const PAYMENT_B   = 'pay_buddy_001';

function makeInitialState(): DbState {
  return {
    bookings: new Map([
      [BOOKING_ID, { id: BOOKING_ID, status: 'awaiting_deposits' }],
    ]),
    deposits: new Map([
      ['dep-traveler', { id: 'dep-traveler', booking_id: BOOKING_ID, side: 'traveler', status: 'pending' }],
      ['dep-buddy',    { id: 'dep-buddy',    booking_id: BOOKING_ID, side: 'buddy',    status: 'pending' }],
    ]),
    payment_events: new Map([
      ['pe-traveler', { id: 'pe-traveler', razorpay_order_id: ORDER_T, razorpay_payment_id: undefined, status: 'initiated' }],
      ['pe-buddy',    { id: 'pe-buddy',    razorpay_order_id: ORDER_B, razorpay_payment_id: undefined, status: 'initiated' }],
    ]),
  };
}

function travelerPayload(paymentId = PAYMENT_T): CapturedPayload {
  return {
    paymentId,
    orderId:       ORDER_T,
    signature:     'sig-traveler',
    capturedAtIso: '2026-05-01T12:00:00Z',
    notes: { booking_id: BOOKING_ID, kind: 'deposit', side: 'traveler', deposit_id: 'dep-traveler' },
  };
}

function buddyPayload(paymentId = PAYMENT_B): CapturedPayload {
  return {
    paymentId,
    orderId:       ORDER_B,
    signature:     'sig-buddy',
    capturedAtIso: '2026-05-01T12:01:00Z',
    notes: { booking_id: BOOKING_ID, kind: 'deposit', side: 'buddy', deposit_id: 'dep-buddy' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: First deposit captured — booking stays in awaiting_deposits
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('first deposit captured — traveler side — booking stays awaiting_deposits', async () => {
  const state = makeInitialState();
  const db    = makeDb(state);

  const outcome = await handleDepositCaptured(db as any, travelerPayload());

  assertEquals(outcome.ok, true);
  if (outcome.ok && outcome.type === 'first_deposit') {
    assertEquals(outcome.bookingStatus, 'awaiting_deposits');
  } else {
    throw new Error(`Unexpected outcome: ${JSON.stringify(outcome)}`);
  }

  // Deposits: traveler held, buddy still pending
  const depT = [...state.deposits.values()].find(d => d.side === 'traveler')!;
  const depB = [...state.deposits.values()].find(d => d.side === 'buddy')!;
  assertEquals(depT.status, 'held');
  assertEquals(depB.status, 'pending');

  // payment_events row marked captured
  const peT = [...state.payment_events.values()].find(pe => pe.razorpay_order_id === ORDER_T)!;
  assertEquals(peT.status, 'captured');
  assertEquals(peT.razorpay_payment_id, PAYMENT_T);

  // Booking unchanged
  assertEquals(state.bookings.get(BOOKING_ID)!.status, 'awaiting_deposits');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Second deposit captured — booking advances to awaiting_balance
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('second deposit captured — buddy side — booking advances to awaiting_balance', async () => {
  const state = makeInitialState();

  // Pre-apply traveler capture so buddy is the second deposit.
  const depT = [...state.deposits.values()].find(d => d.side === 'traveler')!;
  depT.status = 'held';
  depT.razorpay_payment_id = PAYMENT_T;
  const peT  = [...state.payment_events.values()].find(pe => pe.razorpay_order_id === ORDER_T)!;
  peT.status = 'captured';
  peT.razorpay_payment_id = PAYMENT_T;

  const db = makeDb(state);
  const outcome = await handleDepositCaptured(db as any, buddyPayload());

  assertEquals(outcome.ok, true);
  if (outcome.ok && outcome.type === 'both_deposits_held') {
    assertEquals(outcome.bookingStatus, 'awaiting_balance');
  } else {
    throw new Error(`Unexpected outcome: ${JSON.stringify(outcome)}`);
  }

  // Both deposits held
  const depB = [...state.deposits.values()].find(d => d.side === 'buddy')!;
  assertEquals(depB.status, 'held');

  // Booking advanced to awaiting_balance (last write wins after deposits_held)
  assertEquals(state.bookings.get(BOOKING_ID)!.status, 'awaiting_balance');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Idempotency — re-firing the same payment.captured returns idempotent
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('re-firing same payment.captured is idempotent', async () => {
  const state = makeInitialState();

  // Pre-apply as already captured.
  const peT = [...state.payment_events.values()].find(pe => pe.razorpay_order_id === ORDER_T)!;
  peT.status             = 'captured';
  peT.razorpay_payment_id = PAYMENT_T;
  state.deposits.get('dep-traveler')!.status = 'held';

  const db      = makeDb(state);
  const outcome = await handleDepositCaptured(db as any, travelerPayload(PAYMENT_T));

  assertEquals(outcome.ok, true);
  if (outcome.ok) {
    assertEquals(outcome.type, 'idempotent');
  }

  // A fully applied capture is unchanged on replay.
  const depT = [...state.deposits.values()].find(d => d.side === 'traveler')!;
  assertEquals(depT.status, 'held');

  // Booking unchanged
  assertEquals(state.bookings.get(BOOKING_ID)!.status, 'awaiting_deposits');
});

Deno.test('replaying a capture finishes a deposit write that failed after the ledger write', async () => {
  const state = makeInitialState();
  const payment = state.payment_events.get('pe-traveler')!;
  payment.status = 'captured';
  payment.razorpay_payment_id = PAYMENT_T;
  const outcome = await handleDepositCaptured(makeDb(state), travelerPayload());
  assertEquals(outcome.ok, true);
  assertEquals(state.deposits.get('dep-traveler')!.status, 'held');
});

Deno.test('replaying a capture finishes both interrupted booking transitions', async () => {
  for (const status of ['awaiting_deposits', 'deposits_held']) {
    const state = makeInitialState();
    state.bookings.get(BOOKING_ID)!.status = status;
    for (const deposit of state.deposits.values()) deposit.status = 'held';
    const payment = state.payment_events.get('pe-buddy')!;
    payment.status = 'captured';
    payment.razorpay_payment_id = PAYMENT_B;
    const outcome = await handleDepositCaptured(makeDb(state), buddyPayload());
    assertEquals(outcome.ok, true);
    assertEquals(state.bookings.get(BOOKING_ID)!.status, 'awaiting_balance');
  }
});

Deno.test('a replay after refund leaves the ledger and returned deposit unchanged', async () => {
  const state = makeInitialState();
  const payment = state.payment_events.get('pe-traveler')!;
  payment.status = 'refunded';
  payment.razorpay_payment_id = PAYMENT_T;
  state.deposits.get('dep-traveler')!.status = 'refunded';
  state.bookings.get(BOOKING_ID)!.status = 'cancelled_no_pay';
  const outcome = await handleDepositCaptured(makeDb(state), travelerPayload());
  assertEquals(outcome, { ok: true, type: 'idempotent' });
  assertEquals(payment.status, 'refunded');
  assertEquals(state.deposits.get('dep-traveler')!.status, 'refunded');
});

Deno.test('a refund during capture recovery cannot restore the returned deposit or ledger', async () => {
  const state = makeInitialState();
  const payment = state.payment_events.get('pe-buddy')!;
  payment.status = 'captured';
  payment.razorpay_payment_id = PAYMENT_B;
  for (const deposit of state.deposits.values()) deposit.status = 'held';
  const db = makeDb(state, (table) => {
    if (table === 'deposits') {
      payment.status = 'refunded';
      state.deposits.get('dep-buddy')!.status = 'refunded';
    }
  });
  assertEquals(await handleDepositCaptured(db, buddyPayload()), { ok: false, error: 'deposit_changed_during_capture' });
  assertEquals(payment.status, 'refunded');
  assertEquals(state.deposits.get('dep-buddy')!.status, 'refunded');
});

Deno.test('a concurrent cancellation cannot be overwritten or reported as deposits held', async () => {
  const state = makeInitialState();
  state.deposits.get('dep-traveler')!.status = 'held';
  const db = makeDb(state, (table) => {
    if (table === 'bookings') state.bookings.get(BOOKING_ID)!.status = 'cancelled_no_deposit';
  });
  assertEquals(await handleDepositCaptured(db, buddyPayload()), { ok: false, error: 'booking_changed_during_capture' });
  assertEquals(state.bookings.get(BOOKING_ID)!.status, 'cancelled_no_deposit');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: payment.failed — payment_events marked failed, deposit stays pending
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('payment.failed — marks payment_events failed, deposit stays pending, booking unchanged', async () => {
  const state = makeInitialState();
  const db    = makeDb(state);

  const failedPayload: FailedPayload = {
    paymentId: PAYMENT_T,
    orderId:   ORDER_T,
    reason:    'payment_failed',
    notes:     { booking_id: BOOKING_ID, kind: 'deposit', side: 'traveler', deposit_id: 'dep-traveler' },
  };

  const outcome = await handleDepositFailed(db as any, failedPayload);
  assertEquals(outcome.ok, true);

  // payment_events marked failed
  const peT = [...state.payment_events.values()].find(pe => pe.razorpay_order_id === ORDER_T)!;
  assertEquals(peT.status, 'failed');
  assertEquals(peT.razorpay_payment_id, PAYMENT_T);
  assertEquals(peT.failed_reason, 'payment_failed');

  // Deposit stays pending
  const depT = [...state.deposits.values()].find(d => d.side === 'traveler')!;
  assertEquals(depT.status, 'pending');

  // Booking unchanged
  assertEquals(state.bookings.get(BOOKING_ID)!.status, 'awaiting_deposits');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Full happy path — traveler then buddy — both deposits + booking jump
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('full happy path — traveler then buddy — final booking status awaiting_balance', async () => {
  const state  = makeInitialState();
  const db     = makeDb(state);

  // First deposit: traveler
  const r1 = await handleDepositCaptured(db as any, travelerPayload());
  assertEquals(r1.ok, true);
  if (r1.ok) assertEquals(r1.type, 'first_deposit');
  assertEquals(state.bookings.get(BOOKING_ID)!.status, 'awaiting_deposits');

  // Second deposit: buddy
  const r2 = await handleDepositCaptured(db as any, buddyPayload());
  assertEquals(r2.ok, true);
  if (r2.ok) assertEquals(r2.type, 'both_deposits_held');

  // Final booking state
  assertEquals(state.bookings.get(BOOKING_ID)!.status, 'awaiting_balance');

  // Both deposits held
  for (const dep of state.deposits.values()) {
    assertEquals(dep.status, 'held');
  }

  // Both payment_events captured
  for (const pe of state.payment_events.values()) {
    assertEquals(pe.status, 'captured');
  }
});
