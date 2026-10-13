import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLayover, optionFor, mumbaiMinutes } from '../src/lib/layover.mjs';

const plan = (arrival, departure, extra = {}) => planLayover({ arrival, departure, bags: false, onward: 'international', visa: 'visa', ...extra });
const fits = (result) => Object.fromEntries(result.regions.map((region) => [region.key, region.fit]));

test('mirrors the short-layover guide: 5 hours stays airside, 6 hours is tight near the airport', () => {
  assert.equal(plan('2026-11-14T09:30', '2026-11-14T14:30').verdict, 'stay');
  const six = plan('2026-11-14T09:30', '2026-11-14T15:30');
  assert.equal(six.verdict, 'tight');
  assert.equal(fits(six)['near-airport'], 'tight');
  assert.equal(plan('2026-11-14T09:30', '2026-11-14T15:30', { bags: true }).verdict, 'stay');
});

test('8 hours reaches South Mumbai; Elephanta and Kanheri need 7 hours outside in daylight', () => {
  const eight = plan('2026-11-14T09:30', '2026-11-14T17:30');
  assert.equal(eight.outside, 240);
  assert.equal(eight.verdict, 'south');
  assert.equal(plan('2026-11-14T08:00', '2026-11-14T20:00').verdict, 'further');
});

test('a night window is not sold as sightseeing time', () => {
  const night = plan('2026-11-14T22:00', '2026-11-15T08:00');
  assert.equal(night.verdict, 'night');
  assert.ok(night.regions.every((region) => region.fit === 'no'));
  const evening = plan('2026-11-14T18:00', '2026-11-15T06:00');
  assert.equal(fits(evening).further, 'no');
  assert.ok(evening.effective < evening.outside);
});

test('visa, domestic buffer, monsoon and invalid input', () => {
  assert.equal(plan('2026-07-14T09:30', '2026-07-14T19:30', { visa: 'no' }).verdict, 'visa');
  assert.equal(plan('2026-07-14T09:30', '2026-07-14T19:30').monsoon, true);
  assert.equal(plan('2026-11-14T09:30', '2026-11-14T17:30', { onward: 'domestic' }).back, 120);
  assert.ok(plan('2026-11-14T09:30', '2026-11-14T08:30').error);
  assert.ok(plan('', '2026-11-14T08:30').error);
});

test('times are read as Mumbai time and ?outside= maps to directory options', () => {
  assert.equal(mumbaiMinutes('2026-01-01T05:30'), Date.UTC(2026, 0, 1) / 60000);
  assert.equal(optionFor(0), 0);
  assert.equal(optionFor(60), 1);
  assert.equal(optionFor(200), 180);
  assert.equal(optionFor(500), 420);
});
