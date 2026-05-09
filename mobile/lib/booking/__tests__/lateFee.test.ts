// ============================================================================
// LATE FEE EVALUATION TESTS — Phase 3
// ============================================================================
// Boundary tests around T-72h and T-12h, plus assessment-idempotency.
// ============================================================================

import { evaluateLateFee } from '../lateFee';

const HOUR = 60 * 60 * 1000;

// Pin "now" so the math is deterministic. All test trip times are computed
// relative to this anchor.
const NOW = new Date('2026-05-04T12:00:00Z');

const at = (hoursFromNow: number): Date => new Date(NOW.getTime() + hoursFromNow * HOUR);

// ─── Late-fee window (T-72h cutoff) ─────────────────────────────────────────

describe('evaluateLateFee — T-72h boundary', () => {
  it('72.0h until trip → NOT in late-fee window (strictly less than 72)', () => {
    const r = evaluateLateFee(at(72), NOW);
    expect(r.inLateFeeWindow).toBe(false);
  });

  it('71.99h until trip → in late-fee window', () => {
    const r = evaluateLateFee(at(71.99), NOW);
    expect(r.inLateFeeWindow).toBe(true);
  });

  it('100h until trip → not in window (well before)', () => {
    const r = evaluateLateFee(at(100), NOW);
    expect(r.inLateFeeWindow).toBe(false);
  });

  it('1h until trip → in late-fee window', () => {
    const r = evaluateLateFee(at(1), NOW);
    expect(r.inLateFeeWindow).toBe(true);
  });

  it('past trip start → in late-fee window (negative hoursUntilTrip)', () => {
    const r = evaluateLateFee(at(-5), NOW);
    expect(r.inLateFeeWindow).toBe(true);
    expect(r.hoursUntilTrip).toBe(-5);
  });
});

// ─── No-pay-cancel window (T-12h cutoff) ────────────────────────────────────

describe('evaluateLateFee — T-12h boundary', () => {
  it('12.0h until trip → NOT in no-pay window', () => {
    const r = evaluateLateFee(at(12), NOW);
    expect(r.inNoPayCancelWindow).toBe(false);
  });

  it('11.99h until trip → in no-pay window', () => {
    const r = evaluateLateFee(at(11.99), NOW);
    expect(r.inNoPayCancelWindow).toBe(true);
  });
});

// ─── Assessment idempotency ─────────────────────────────────────────────────

describe('evaluateLateFee — assessment idempotency', () => {
  it('shouldAccrue=true when in window AND not yet assessed', () => {
    const r = evaluateLateFee(at(70), NOW, false);
    expect(r.inLateFeeWindow).toBe(true);
    expect(r.shouldAccrue).toBe(true);
  });

  it('shouldAccrue=false when already assessed (even if still in window)', () => {
    const r = evaluateLateFee(at(70), NOW, true);
    expect(r.inLateFeeWindow).toBe(true);
    expect(r.shouldAccrue).toBe(false);
  });

  it('shouldAccrue=false when not in window (regardless of flag)', () => {
    expect(evaluateLateFee(at(100), NOW, false).shouldAccrue).toBe(false);
    expect(evaluateLateFee(at(100), NOW, true).shouldAccrue).toBe(false);
  });
});

// ─── Output shape ───────────────────────────────────────────────────────────

describe('evaluateLateFee — output shape', () => {
  it('lateFeePaise is always 100_000 (₹1,000)', () => {
    expect(evaluateLateFee(at(100), NOW).lateFeePaise).toBe(100_000);
    expect(evaluateLateFee(at(50), NOW).lateFeePaise).toBe(100_000);
    expect(evaluateLateFee(at(5), NOW).lateFeePaise).toBe(100_000);
  });

  it('hoursUntilTrip is positive when trip is in future', () => {
    expect(evaluateLateFee(at(48), NOW).hoursUntilTrip).toBe(48);
  });
});
