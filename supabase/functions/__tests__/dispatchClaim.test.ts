import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { claimDispatch, finishDispatchClaim } from '../_shared/dispatchClaim.ts';

Deno.test('a disputed/claimed dispatch never reaches the provider path', async () => {
  const db = { rpc: () => Promise.resolve({ data: false, error: null }), from: () => { throw new Error('must not read or send'); } };
  assertEquals(await claimDispatch(db, { id: 'dispatch' }), false);
});

Deno.test('a successful claim uses the current adjudicated amount rather than a stale list row', async () => {
  const row = { id: 'dispatch', net_paise: 150000 };
  const db = {
    rpc: () => Promise.resolve({ data: true, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'dispatch', net_paise: 60000 }, error: null }) }) }) }),
  };
  assertEquals(await claimDispatch(db, row), true);
  assertEquals(row.net_paise, 60000);
});

Deno.test('claim errors fail closed', async () => {
  await assertRejects(() => claimDispatch({ rpc: () => Promise.resolve({ error: { message: 'offline' } }) }, { id: 'dispatch' }), Error, 'dispatch_claim_failed');
});

Deno.test('an uncertain result retains its claim; stored results and safe preflight failures release it', async () => {
  for (const [status, failed_reason, expected] of [
    ['pending', null, false],
    ['failed', 'Error: provider timeout', false],
    ['failed', 'Error: refund_result_not_saved', false],
    ['sent', null, true],
    ['pending', 'razorpay_live_not_configured', true],
    ['failed', 'Error: vpa_missing', true],
  ] as const) {
    let released = false;
    const db = { from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status, failed_reason }, error: null }) }) }),
      update: () => ({ eq: () => { released = true; return Promise.resolve({ error: null }); } }),
    }) };
    await finishDispatchClaim(db, 'dispatch');
    assertEquals(released, expected, `${status}: ${failed_reason}`);
  }
});
