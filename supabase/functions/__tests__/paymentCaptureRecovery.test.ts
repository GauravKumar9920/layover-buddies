import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleBalanceCaptured } from '../_shared/balanceCapture.ts';
import { handleTopUpCaptured } from '../_shared/topupCapture.ts';
import { existingTopUpOrder, linkTopUpOrder } from '../_shared/topupOrder.ts';
import { idempotencyKey } from '../_shared/razorpayClient.ts';

type Row = Record<string, any>;

function makeDb(tables: Record<string, Row[]>, failTable?: string, beforeUpdate?: (table: string, patch: Row) => void) {
  let failed = false;
  return {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let patch: Row | null = null;
      let single = false;
      const query = {
        select(_columns: string) { return query; },
        update(value: Row) { patch = value; return query; },
        eq(key: string, value: unknown) { filters.push((row) => row[key] === value); return query; },
        in(key: string, values: unknown[]) { filters.push((row) => values.includes(row[key])); return query; },
        maybeSingle() { single = true; return query; },
        then(resolve: (result: unknown) => void) {
          if (patch) beforeUpdate?.(table, patch);
          if (patch && table === failTable && !failed) {
            failed = true;
            return Promise.resolve({ data: null, error: { message: 'temporary failure' } }).then(resolve);
          }
          const rows = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)));
          if (patch) rows.forEach((row) => Object.assign(row, patch));
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}

const balancePayload = {
  paymentId: 'pay-balance', orderId: 'order-balance', capturedAtIso: '2026-10-13T10:00:00Z',
  notes: { booking_id: 'booking-1', kind: 'balance' as const, is_late_fee_component: false },
};

Deno.test('a balance webhook retry finishes the booking after a successful ledger write', async () => {
  const payment = { id: 'ledger-1', status: 'initiated', razorpay_order_id: 'order-balance' };
  const booking = { id: 'booking-1', status: 'awaiting_balance' };
  const db = makeDb({ payment_events: [payment], bookings: [booking] }, 'bookings');
  assertEquals((await handleBalanceCaptured(db, balancePayload)).ok, false);
  assertEquals(payment.status, 'captured');
  assertEquals(booking.status, 'awaiting_balance');
  assertEquals(await handleBalanceCaptured(db, balancePayload), { ok: true, type: 'balance_paid', bookingStatus: 'balance_paid' });
  assertEquals(booking.status, 'balance_paid');
});

Deno.test('a concurrent cancellation cannot be overwritten or reported as balance paid', async () => {
  const payment = { id: 'ledger-1', status: 'initiated', razorpay_order_id: 'order-balance' };
  const booking = { id: 'booking-1', status: 'awaiting_balance' };
  const db = makeDb({ payment_events: [payment], bookings: [booking] }, undefined, (table) => {
    if (table === 'bookings') booking.status = 'cancelled_no_pay';
  });
  assertEquals(await handleBalanceCaptured(db, balancePayload), { ok: false, error: 'booking_changed_during_capture' });
  assertEquals(booking.status, 'cancelled_no_pay');
});

Deno.test('a concurrent refund cannot be overwritten by a balance capture', async () => {
  const payment = { id: 'ledger-1', status: 'initiated', razorpay_order_id: 'order-balance' };
  const booking = { id: 'booking-1', status: 'awaiting_balance' };
  const db = makeDb({ payment_events: [payment], bookings: [booking] }, undefined, (table) => {
    if (table === 'payment_events') payment.status = 'refunded';
  });
  assertEquals(await handleBalanceCaptured(db, balancePayload), { ok: false, error: 'payment_changed_during_capture' });
  assertEquals(payment.status, 'refunded');
});

Deno.test('a delayed balance capture replay preserves a completed booking', async () => {
  const payment = { id: 'ledger-1', status: 'captured', razorpay_order_id: 'order-balance', razorpay_payment_id: 'pay-balance' };
  const booking = { id: 'booking-1', status: 'completed' };
  assertEquals(await handleBalanceCaptured(makeDb({ payment_events: [payment], bookings: [booking] }), balancePayload), { ok: true, type: 'idempotent' });
  assertEquals(booking.status, 'completed');
});

Deno.test('top-up retry reuses its recorded order after the request-link write failed', async () => {
  const { payment, request, tables } = topUpFixture();
  Object.assign(payment, { idempotency_key: await idempotencyKey(['topup_order', 'booking-1', 'topup-1']) });
  const db = makeDb(tables, 'top_up_requests');
  await assertRejects(() => linkTopUpOrder(db, 'booking-1', 'topup-1', 'order-topup'), Error, 'topup_order_link_failed');
  const reused = await existingTopUpOrder(db, 'booking-1', 'topup-1', null);
  assertEquals(reused.payment?.razorpay_order_id, 'order-topup');
  await linkTopUpOrder(db, 'booking-1', 'topup-1', reused.payment!.razorpay_order_id);
  assertEquals((request as Row).razorpay_order_id, 'order-topup');
  assertEquals(tables.payment_events.length, 1);
});

Deno.test('failed legacy top-up orders stay retryable and captured ones cannot be paid again', async () => {
  const { payment, tables } = topUpFixture('failed');
  assertEquals((await existingTopUpOrder(makeDb(tables), 'booking-1', 'topup-1', 'order-topup')).payment?.id, 'ledger-1');
  payment.status = 'captured';
  await assertRejects(() => existingTopUpOrder(makeDb(tables), 'booking-1', 'topup-1', 'order-topup'), Error, 'topup_already_paid');
});

const topUpPayload = {
  razorpay_payment_id: 'pay-topup', razorpay_order_id: 'order-topup', amount_paise: 15000,
  booking_id: 'booking-1', top_up_request_id: 'topup-1',
};

function topUpFixture(status = 'initiated') {
  const payment = { id: 'ledger-1', status, kind: 'top_up', booking_id: 'booking-1', amount_paise: 15000, razorpay_order_id: 'order-topup' };
  const request = { id: 'topup-1', status: 'approved', booking_id: 'booking-1' };
  return { payment, request, tables: { payment_events: [payment], top_up_requests: [request] } };
}

Deno.test('a top-up capture after a failed attempt updates its existing ledger once', async () => {
  const { payment, request, tables } = topUpFixture('failed');
  assertEquals((await handleTopUpCaptured(makeDb(tables), topUpPayload)).ok, true);
  assertEquals(payment.status, 'captured');
  assertEquals(request.status, 'captured');
  assertEquals(tables.payment_events.length, 1);
  assertEquals(await handleTopUpCaptured(makeDb(tables), topUpPayload), { ok: true, idempotent: true, payment_event_id: 'ledger-1' });
});

Deno.test('a top-up webhook retries a failed dependent write and completes it', async () => {
  const { payment, request, tables } = topUpFixture();
  const db = makeDb(tables, 'top_up_requests');
  await assertRejects(() => handleTopUpCaptured(db, topUpPayload), Error, 'request capture write failed');
  assertEquals(payment.status, 'captured');
  assertEquals(request.status, 'approved');
  assertEquals((await handleTopUpCaptured(db, topUpPayload)).ok, true);
  assertEquals(request.status, 'captured');
});

Deno.test('a missing ledger or mismatched top-up amount cannot create a duplicate capture', async () => {
  await assertRejects(() => handleTopUpCaptured(makeDb({}), topUpPayload), Error, 'ledger unavailable');
  const { payment, tables } = topUpFixture();
  await assertRejects(() => handleTopUpCaptured(makeDb(tables), { ...topUpPayload, amount_paise: 1 }), Error, 'does not match');
  assertEquals(payment.status, 'initiated');
});
