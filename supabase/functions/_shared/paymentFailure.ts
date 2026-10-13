export interface FailedPayment {
  paymentId: string;
  orderId: string;
  reason: string;
}

/** Failed checkout attempts never reverse a capture or refund for the order. */
export async function handlePaymentFailed(
  db: { from(table: string): any },
  payload: FailedPayment,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db.from('payment_events').update({
    status: 'failed',
    razorpay_payment_id: payload.paymentId,
    failed_reason: payload.reason,
  }).eq('razorpay_order_id', payload.orderId).eq('status', 'initiated');
  if (error) return { ok: false, error: `db_error: ${error.message}` };
  return { ok: true };
}
