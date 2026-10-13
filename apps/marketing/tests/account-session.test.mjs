import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const code = await readFile(new URL('../public/assets/account-lite.js', import.meta.url), 'utf8');
const expired = { access_token: 'old-access', refresh_token: 'old-refresh', expires_at: 1, user: { id: 'traveler-1' } };
const renewed = { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, user: { id: 'traveler-1' } };

function setup(fetch, session = expired) {
  let stored = session ? JSON.stringify(session) : null;
  const storage = {
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
    removeItem: () => { stored = null; },
  };
  const window = {};
  vm.runInNewContext(code, {
    window, fetch, localStorage: storage, Date, location: { pathname: '/' },
    document: { querySelector: () => ({ getAttribute: () => 'configured' }), querySelectorAll: () => [] },
    dispatchEvent() {}, CustomEvent: class {},
  });
  return { account: window.DetourAccount, storage, session: () => JSON.parse(stored) };
}

test('temporary refresh failures preserve the session for a later retry', async () => {
  for (const failure of [() => { throw new Error('offline'); }, () => ({ ok: false, status: 429 }), () => ({ ok: false, status: 503 })]) {
    let attempts = 0;
    const app = setup(async () => ++attempts === 1 ? failure() : { ok: true, json: async () => renewed });
    assert.equal(await app.account.accessToken(), null);
    assert.deepEqual(app.session(), expired);
    assert.equal(await app.account.accessToken(), renewed.access_token);
    assert.equal(app.session().refresh_token, renewed.refresh_token);
  }
});

test('a rejected refresh token signs out the original session', async () => {
  const app = setup(async () => ({ ok: false, status: 400 }));
  assert.equal(await app.account.accessToken(), null);
  assert.equal(app.session(), null);
});

test('an in-flight refresh cannot restore a session after sign-out', async () => {
  let finish;
  const app = setup(() => new Promise((resolve) => { finish = resolve; }));
  const token = app.account.accessToken();
  app.storage.removeItem('detour-auth');
  finish({ ok: true, json: async () => renewed });
  assert.equal(await token, null);
  assert.equal(app.session(), null);
});

test('an in-flight refresh cannot replace or clear a newly signed-in account', async () => {
  for (const response of [{ ok: true, json: async () => renewed }, { ok: false, status: 400 }]) {
    let finish;
    const app = setup(() => new Promise((resolve) => { finish = resolve; }));
    const token = app.account.accessToken();
    const other = { ...renewed, access_token: 'other-access', refresh_token: 'other-refresh', user: { id: 'traveler-2' } };
    app.storage.setItem('detour-auth', JSON.stringify(other));
    finish(response);
    assert.equal(await token, null);
    assert.deepEqual(app.session(), other);
  }
});

test('saving a place while signed out rejects without throwing synchronously', async () => {
  const app = setup(async () => { throw new Error('unexpected request'); }, null);
  await assert.rejects(app.account.savePlace('gateway-of-india'), { code: 'signed_out' });
});
