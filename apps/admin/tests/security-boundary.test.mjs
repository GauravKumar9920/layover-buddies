import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

test('browser source contains no legacy password or privileged-key configuration', async () => {
  const files = await sourceFiles(join(root, 'src'));
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(source, /VITE_ADMIN_PASSWORD/);
  assert.doesNotMatch(source, /VITE_SUPABASE_SERVICE_KEY/);
  assert.doesNotMatch(source, /\.from\(['"`]users['"`]\)/);
  assert.doesNotMatch(source, /\.from\(['"`]bookings['"`]\)/);
});

test('all application data crosses the typed function boundary', async () => {
  const api = await readFile(join(root, 'src/lib/api.ts'), 'utf8');
  assert.match(api, /const ADMIN_API = 'admin-api'/);
  assert.match(api, /const GROWTH_API = 'admin-growth-report'/);
  assert.match(api, /\{ operation, payload \}/);
});

test('hosted SPA denies framing and has history rewrites', async () => {
  const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
  assert.equal(config.rewrites[0].destination, '/index.html');
  const headers = Object.fromEntries(config.headers[0].headers.map((entry) => [entry.key, entry.value]));
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(headers['Content-Security-Policy'], /script-src 'self'/);
});

test('Action Centre fails closed when an upstream source is degraded', async () => {
  const source = await readFile(join(root, 'src/pages/Overview.tsx'), 'utf8');
  assert.match(source, /actions\.meta\.warnings\?\.length \|\| overview\.meta\.warnings\?\.length \|\| overview\.error/);
  assert.match(source, /actionCoverageDegraded \? \(/);
  assert.match(source, /Action coverage is degraded/);
  assert.match(source, /Treat the queue as incomplete/);
});

test('SOS uses the non-PII realtime signal and reports use admin notes', async () => {
  const source = await readFile(join(root, 'src/pages/TrustSafety.tsx'), 'utf8');
  assert.match(source, /table: 'admin_realtime_signals'/);
  assert.match(source, /event: 'INSERT'/);
  assert.match(source, /filter: 'topic=eq\.sos'/);
  assert.match(source, /void alerts\.refresh\(\)/);
  assert.match(source, /removeChannel\(channel\)/);

  const reportTransition = source.match(/adminRequest\('reports\.transition',[\s\S]*?\);/);
  assert.ok(reportTransition, 'reports.transition command is present');
  assert.match(reportTransition[0], /adminNotes: reason/);
  assert.doesNotMatch(reportTransition[0], /resolutionNotes/);
});

test('finance filters match the server contract and all-time uses the server all-time semantic', async () => {
  const source = await readFile(join(root, 'src/pages/Money.tsx'), 'utf8');
  assert.match(source, /startDate: undefined/);

  const moneyList = source.match(/export function MoneyListPage[\s\S]*?export function CancellationsPage/);
  assert.ok(moneyList, 'MoneyListPage is present');
  assert.match(moneyList[0], /\['all', 'pending', 'sent', 'failed'\]\.map/);
  assert.doesNotMatch(moneyList[0], /\['all', 'pending', 'processing', 'completed', 'failed', 'stubbed'\]/);
});
