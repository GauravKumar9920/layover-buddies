import { idempotencyKey } from './razorpayClient.ts';

export async function existingTopUpOrder(
  db: { from(table: string): any },
  bookingId: string,
  requestId: string,
  legacyOrderId: string | null,
): Promise<{ key: string; payment: { id: string; razorpay_order_id: string; status: string } | null }> {
  const key = await idempotencyKey(['topup_order', bookingId, requestId]);
  const lookup = (column: string, value: string) => db.from('payment_events')
    .select('id,razorpay_order_id,status').eq('booking_id', bookingId).eq('kind', 'top_up')
    .eq(column, value).maybeSingle();
  let result = await lookup('idempotency_key', key);
  if (result.error) throw new Error('payment_event_lookup_failed');
  // Orders created before the stable request key was introduced still reuse
  // the provider order linked to the request.
  if (!result.data && legacyOrderId) result = await lookup('razorpay_order_id', legacyOrderId);
  if (result.error) throw new Error('payment_event_lookup_failed');
  if (result.data && !['initiated', 'failed'].includes(result.data.status)) {
    throw new Error('topup_already_paid');
  }
  return { key, payment: result.data };
}

export async function linkTopUpOrder(
  db: { from(table: string): any },
  bookingId: string,
  requestId: string,
  orderId: string,
): Promise<void> {
  const { data, error } = await db.from('top_up_requests').update({ razorpay_order_id: orderId })
    .eq('id', requestId).eq('booking_id', bookingId).eq('status', 'approved').select('id').maybeSingle();
  if (error || !data) throw new Error('topup_order_link_failed');
}
