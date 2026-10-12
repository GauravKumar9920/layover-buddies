import test from 'node:test';
import assert from 'node:assert/strict';
import { contentSearchScore, normalizeSearch, searchContent } from '../src/scripts/content-search.js';

const publicIndex = [
  { route: '/guides/csmt', title: 'CSMT heritage quarter', navigationTitle: 'CSMT', summary: 'A railway landmark in South Mumbai.', aliases: ['VT', 'Victoria Terminus'], tags: ['heritage'], section: 'explore', kind: 'place' },
  { route: '/guides/csmt/photos', title: 'CSMT photographs', summary: 'Inside the station dome.', aliases: [], tags: ['photographs'], section: 'explore', kind: 'gallery', parentRoute: '/guides/csmt' },
  { route: '/guides/bags', title: 'Luggage storage', summary: 'Leave your bags at the airport.', aliases: ['cloakroom'], tags: ['airport'], section: 'plan', kind: 'guide' },
  { route: '/guides/8-hours', title: 'Eight-hour layover', summary: 'A plan with an airport return buffer.', aliases: ['8 hours', 'eight hours'], tags: ['layover'], section: 'plan', group: 'by-time', kind: 'guide' },
  { route: '/downloads/quick-reference.pdf', title: 'Mumbai cheat sheet', summary: 'A printable one-page planning reference.', aliases: ['PDF', 'download'], tags: [], section: 'plan', kind: 'resource' },
];

test('normalizes accents, punctuation and spacing without losing non-Latin letters', () => {
  assert.equal(normalizeSearch('  Café — Kala-Ghoda  '), 'cafe kala ghoda');
  assert.equal(normalizeSearch('मुंबई'), 'मुंबई');
});

test('finds aliases and multiword questions across title and summary', () => {
  assert.equal(searchContent(publicIndex, { query: 'VT' })[0].route, '/guides/csmt');
  assert.equal(searchContent(publicIndex, { query: 'bags airport' })[0].route, '/guides/bags');
  assert.equal(searchContent(publicIndex, { query: '8 hours' })[0].route, '/guides/8-hours');
  assert.equal(searchContent(publicIndex, { query: 'DOWNLOAD' })[0].route, '/downloads/quick-reference.pdf');
});

test('all query words must match and readable titles rank above summary mentions', () => {
  assert.equal(contentSearchScore(publicIndex[2], 'luggage heritage'), 0);
  const titleMatch = { title: 'Airport luggage', summary: '', tags: [], aliases: [] };
  const summaryMatch = { title: 'Useful advice', summary: 'Airport luggage', tags: [], aliases: [] };
  assert.ok(contentSearchScore(titleMatch, 'airport luggage') > contentSearchScore(summaryMatch, 'airport luggage'));
});

test('section and type filters compose with the query and have a clear no-match result', () => {
  assert.deepEqual(searchContent(publicIndex, { section: 'plan', kind: 'resource' }).map(item => item.route), ['/downloads/quick-reference.pdf']);
  assert.equal(searchContent(publicIndex, { query: 'heritage', section: 'plan' }).length, 0);
  assert.equal(searchContent(publicIndex, { query: '<script>alert(1)</script>' }).length, 0);
  assert.deepEqual(searchContent(publicIndex, { kind: 'time-plan' }).map(item => item.route), ['/guides/8-hours']);
});

test('gallery matches and photo filtering return the parent once, without separate gallery rows', () => {
  assert.deepEqual(searchContent(publicIndex, { query: 'dome' }).map(item => item.route), ['/guides/csmt']);
  assert.deepEqual(searchContent(publicIndex, { kind: 'gallery' }).map(item => item.route), ['/guides/csmt']);
  assert.equal(searchContent(publicIndex).length, 4);
});
