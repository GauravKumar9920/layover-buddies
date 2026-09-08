/** Database claim serializes provider calls with support reports and retries. */
export async function claimDispatch(db: any, dispatch: { id: string }): Promise<boolean> {
  const { data, error } = await db.rpc('claim_booking_dispatch_tx', { p_dispatch_id: dispatch.id });
  if (error) throw new Error('dispatch_claim_failed');
  if (data !== true) return false;
  const fresh = await db.from('payout_dispatches').select('*').eq('id', dispatch.id).single();
  if (fresh.error || !fresh.data) throw new Error('dispatch_refresh_failed');
  Object.assign(dispatch, fresh.data);
  if (fresh.data.net_paise === 0) {
    const saved = await db.from('payout_dispatches').update({ status: 'sent', completed_at: new Date().toISOString(), dispatch_claimed_at: null }).eq('id', dispatch.id);
    if (saved.error) throw new Error('zero_dispatch_failed');
    return false;
  }
  return true;
}
/** Only release when no money moved (stub) or the confirmed result is stored. */
export async function finishDispatchClaim(db: any, id: string): Promise<void> {
  const { data, error } = await db.from('payout_dispatches').select('status,failed_reason').eq('id', id).maybeSingle();
  if (!error && (data?.status === 'sent' || ['razorpay_live_not_configured', 'Error: vpa_missing'].includes(data?.failed_reason))) {
    await db.from('payout_dispatches').update({ dispatch_claimed_at: null }).eq('id', id);
  }
}
