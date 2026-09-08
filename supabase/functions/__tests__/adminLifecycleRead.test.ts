import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { executeReadOperation } from '../_shared/adminOperations.ts';
const id = 'eeeeeeee-0000-4000-a000-000000000090';
Deno.test('support case read validates the booking and returns cases without client table access', async () => {
  const calls: unknown[] = [];
  const query = { select(value: string) { calls.push(value); return this; }, eq(key: string, value: string) { calls.push([key,value]); return this; }, order() { return this; }, limit() { return Promise.resolve({ data: [{ id: 'case-1' }], error: null }); } };
  const ctx = { db: { from(table: string) { calls.push(table); return query; } }, userId: id, role: 'owner', requestId: 'test' } as any;
  assertEquals((await executeReadOperation('lifecycle.list', { id }, ctx)).data, [{ id: 'case-1' }]);
  assertEquals(calls, ['booking_support_cases','*',['booking_id',id]]);
  await assertRejects(() => executeReadOperation('lifecycle.list', { id: 'invalid' }, ctx));
});
