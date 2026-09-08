import { createRefund, idempotencyKey } from './razorpayClient.ts';
/** Allocate against this recipient's original payments; retries keep allocation IDs. */
export async function refundDispatch(db: any, dispatch: { id: string; booking_id: string; kind: string }): Promise<void> {
  const { data, error } = await db.rpc('reserve_dispatch_refunds_tx', { p_dispatch_id: dispatch.id });
  if (error) throw new Error(error.message);
  let refundId: string | null = null;
  for (const allocation of data ?? []) {
    refundId = allocation.razorpay_refund_id;
    if (allocation.status === 'sent') continue;
    const result = await createRefund({ payment_id: allocation.payment_id, amount_paise: allocation.amount_paise, idempotency_key: await idempotencyKey(['refund-allocation', allocation.id]), notes: { booking_id: dispatch.booking_id, kind: dispatch.kind } });
    refundId = result.refund_id;
    const saved = await db.from('refund_payment_allocations').update({ status: 'sent', razorpay_refund_id: refundId }).eq('id', allocation.id);
    if (saved.error) throw new Error('refund_result_not_saved');
  }
  const saved = await db.from('payout_dispatches').update({ status: 'sent', razorpay_refund_id: refundId, failed_reason: null, completed_at: new Date().toISOString() }).eq('id', dispatch.id);
  if (saved.error) throw new Error('dispatch_result_not_saved');
}
