import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const code = await readFile(new URL('../public/assets/booking.js', import.meta.url), 'utf8');

function setup(account) {
  const calls = [];
  const window = { DetourAnalytics: { track() {} }, DetourUTM: {}, ...(account ? { DetourAccount: account } : {}) };
  const context = {
    window,
    document: { querySelector: (s) => (s.startsWith('meta') ? { getAttribute: () => '/test-lead' } : null), querySelectorAll: () => [], getElementById: () => null },
    location: { pathname: '/' }, addEventListener() {}, AbortSignal,
    FormData: class { constructor(form) { this.form = form; } entries() { return Object.entries(this.form); } },
    fetch: async (url, options) => { calls.push(options.headers); return { status: 201, ok: true, json: async () => ({ data: { leadId: 'x' } }) }; },
  };
  vm.runInNewContext(code, context);
  return { submit: window.DetourLeads.submit, calls };
}
const form = { name: 'Preview', email: 'test@example.com', arrival: '2026-12-20T22:00:00+05:30', departure: '2026-12-21T06:00:00+05:30', _honey: '' };

test('a signed-in visitor sends their access token so the lead is linked to the account', async () => {
  const s = setup({ signedIn: () => true, accessToken: async () => 'header.payload.sig', user: () => ({}) });
  await s.submit(form, 'detour');
  assert.equal(s.calls[0].Authorization, 'Bearer header.payload.sig');
});

test('signed-out visitors and failed refreshes send no Authorization header', async () => {
  const out = setup(null);
  await out.submit(form, 'detour');
  assert.equal(out.calls[0].Authorization, undefined);
  const stale = setup({ signedIn: () => true, accessToken: async () => { throw new Error('refresh failed'); }, user: () => ({}) });
  await stale.submit(form, 'detour');
  assert.equal(stale.calls[0].Authorization, undefined);
});
