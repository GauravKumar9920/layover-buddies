import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handlePaymentFailed } from '../_shared/paymentFailure.ts';

function makeDb(rows: Record<string, unknown>[], error: { message: string } | null = null) {
  return {
    from(table: string) {
      assertEquals(table, 'payment_events');
      return {
        update(patch: Record<string, unknown>) {
          const filters: [string, unknown][] = [];
          const query = {
            eq(key: string, value: unknown) { filters.push([key, value]); return query; },
            then(resolve: (value: unknown) => void) {
              if (!error) rows.filter((row) => filters.every(([key, value]) => row[key] === value))
                .forEach((row) => Object.assign(row, patch));
              return Promise.resolve({ error }).then(resolve);
            },
          };
          return query;
        },
      };
    },
  };
}

Deno.test('a delayed failed attempt cannot overwrite captured or refunded payments', async () => {
  for (const status of ['captured', 'refunded']) {
    const payment = { razorpay_order_id: 'order-1', razorpay_payment_id: 'paid-1', status };
    const result = await handlePaymentFailed(makeDb([payment]), { paymentId: 'failed-attempt', orderId: 'order-1', reason: 'declined' });
    assertEquals(result, { ok: true });
    assertEquals(payment, { razorpay_order_id: 'order-1', razorpay_payment_id: 'paid-1', status });
  }
});

Deno.test('only the initiated payment for the matching order becomes failed', async () => {
  const payment = { razorpay_order_id: 'order-1', status: 'initiated' };
  const unrelated = { razorpay_order_id: 'order-2', status: 'initiated' };
  const result = await handlePaymentFailed(makeDb([payment, unrelated]), { paymentId: 'failed-1', orderId: 'order-1', reason: 'declined' });
  assertEquals(result, { ok: true });
  assertEquals(payment, { razorpay_order_id: 'order-1', status: 'failed', razorpay_payment_id: 'failed-1', failed_reason: 'declined' });
  assertEquals(unrelated.status, 'initiated');
});

Deno.test('database failures are returned so the webhook requests a retry', async () => {
  const result = await handlePaymentFailed(makeDb([], { message: 'unavailable' }), { paymentId: 'failed-1', orderId: 'order-1', reason: 'declined' });
  assertEquals(result, { ok: false, error: 'db_error: unavailable' });
});
