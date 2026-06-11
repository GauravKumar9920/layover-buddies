// ============================================================================
// CANCELLATION SNAPSHOT TESTS — Phase 3
// ============================================================================
// Table-driven tests covering every row of §7 truth table. Asserts the
// resolution math and `next_booking_status` for each tier.
// ============================================================================

import { computeCancellationResolution } from '../cancellationSnapshot';
import type { CancellationInputs } from '../cancellationSnapshot';

const TRAVELER_ID = '00000000-0000-0000-0000-000000000001';

const baseInputs = (overrides: Partial<CancellationInputs> = {}): CancellationInputs => ({
  currentStatus: 'awaiting_balance',
  trigger: 'voluntary',
  triggerActor: 'traveler',
  hoursUntilTrip: 100,
  travelerDepositHeld: true,
  buddyDepositHeld: true,
  balancePaid: false,
  buddyFeePaise: 200_000,
  tripPotPaise: 360_000,
  lateFeePaise: 0,
  travelerUserId: TRAVELER_ID,
  ...overrides,
});

// ─── Tier: gt_72h (traveler cancels >72h before trip) ───────────────────────

describe('gt_72h — traveler voluntary cancel >72h before trip', () => {
  it('full deposit refund both sides; balance not paid → buffer/fee not_paid', () => {
    const r = computeCancellationResolution(baseInputs({ hoursUntilTrip: 100 }));
    expect(r.tier).toBe('gt_72h');
    expect(r.next_booking_status).toBe('cancelled_traveler_voluntary');
    expect(r.traveler_deposit).toEqual({ fate: 'refunded', amount_paise: 50_000 });
    expect(r.buddy_deposit).toEqual({ fate: 'refunded', amount_paise: 50_000 });
    expect(r.itinerary_buffer).toEqual({ fate: 'not_paid', amount_paise: 0 });
    expect(r.buddy_fee).toEqual({ fate: 'not_paid', amount_paise: 0 });
    expect(r.buddy_ban).toBe(false);
  });

  it('with balance paid → full refund of buffer + fee', () => {
    const r = computeCancellationResolution(baseInputs({
      hoursUntilTrip: 100, balancePaid: true,
    }));
    expect(r.itinerary_buffer).toEqual({ fate: 'refunded', amount_paise: 360_000 });
    expect(r.buddy_fee).toEqual({ fate: 'refunded', amount_paise: 200_000 });
  });
});

// ─── Tier: 24_to_72h ────────────────────────────────────────────────────────

describe('24_to_72h — traveler voluntary cancel 24-72h before trip', () => {
  it('50% refund of traveler deposit + buffer + fee; buddy deposit fully refunded', () => {
    const r = computeCancellationResolution(baseInputs({
      hoursUntilTrip: 48, balancePaid: true,
    }));
    expect(r.tier).toBe('24_to_72h');
    expect(r.traveler_deposit).toEqual({ fate: 'refunded', amount_paise: 25_000 });
    expect(r.buddy_deposit).toEqual({ fate: 'refunded', amount_paise: 50_000 });
    expect(r.itinerary_buffer).toEqual({ fate: 'refunded', amount_paise: 180_000 });
    expect(r.buddy_fee).toEqual({ fate: 'refunded', amount_paise: 100_000 });
  });

  it('boundary at 72h exactly is treated as 24_to_72h tier', () => {
    const r = computeCancellationResolution(baseInputs({ hoursUntilTrip: 72 }));
    expect(r.tier).toBe('24_to_72h');
  });

  it('boundary at 24h exactly is treated as 24_to_72h tier', () => {
    const r = computeCancellationResolution(baseInputs({ hoursUntilTrip: 24 }));
    expect(r.tier).toBe('24_to_72h');
  });
});

// ─── Tier: lt_24h ───────────────────────────────────────────────────────────

describe('lt_24h — traveler voluntary cancel <24h before trip', () => {
  it('traveler deposit + buffer + fee → voucher placeholder; buddy deposit refunded', () => {
    const r = computeCancellationResolution(baseInputs({
      hoursUntilTrip: 12, balancePaid: true,
    }));
    expect(r.tier).toBe('lt_24h');
    expect(r.traveler_deposit.fate).toBe('voucher');
    expect(r.traveler_deposit.amount_paise).toBe(50_000);
    expect(r.traveler_deposit.voucher_paise).toBe(50_000);
    expect(r.buddy_deposit).toEqual({ fate: 'refunded', amount_paise: 50_000 });
    expect(r.itinerary_buffer.fate).toBe('voucher');
    expect(r.buddy_fee.fate).toBe('voucher');
  });

  it('boundary at 23.9h is lt_24h tier', () => {
    const r = computeCancellationResolution(baseInputs({ hoursUntilTrip: 23.9 }));
    expect(r.tier).toBe('lt_24h');
  });
});

// ─── Tier: late_no_pay (cron-triggered) ─────────────────────────────────────

describe('late_no_pay — T-12h reached without balance payment', () => {
  it('traveler deposit forfeited; buddy deposit refunded; late fee forfeited to platform', () => {
    const r = computeCancellationResolution(baseInputs({
      currentStatus: 'late_fee_due',
      trigger: 't_minus_12_no_pay',
      triggerActor: 'system',
      hoursUntilTrip: 11.5,
      balancePaid: false,
      lateFeePaise: 100_000,
    }));
    expect(r.tier).toBe('late_no_pay');
    expect(r.next_booking_status).toBe('cancelled_no_pay');
    expect(r.traveler_deposit).toEqual({ fate: 'forfeited', amount_paise: 50_000 });
    expect(r.buddy_deposit).toEqual({ fate: 'refunded', amount_paise: 50_000 });
    expect(r.late_fee).toEqual({ fate: 'forfeited', amount_paise: 100_000 });
  });

  it('with no late fee assessed → late_fee component is waived', () => {
    const r = computeCancellationResolution(baseInputs({
      trigger: 't_minus_12_no_pay',
      triggerActor: 'system',
      hoursUntilTrip: 11,
      lateFeePaise: 0,
    }));
    expect(r.late_fee).toEqual({ fate: 'waived', amount_paise: 0 });
  });
});

// ─── Tier: buddy_cancel ─────────────────────────────────────────────────────

describe('buddy_cancel — buddy initiates cancellation', () => {
  it('full refund to traveler + ₹500 platform credit; buddy forfeits deposit + ban', () => {
    const r = computeCancellationResolution(baseInputs({
      triggerActor: 'buddy',
      balancePaid: true,
    }));
    expect(r.tier).toBe('buddy_cancel');
    expect(r.next_booking_status).toBe('cancelled_buddy');
    expect(r.traveler_deposit).toEqual({ fate: 'refunded', amount_paise: 50_000 });
    expect(r.buddy_deposit).toEqual({ fate: 'forfeited', amount_paise: 50_000 });
    expect(r.itinerary_buffer).toEqual({ fate: 'refunded', amount_paise: 360_000 });
    expect(r.buddy_fee).toEqual({ fate: 'refunded', amount_paise: 200_000 });
    expect(r.platform_credit.issue_to_user_id).toBe(TRAVELER_ID);
    expect(r.platform_credit.amount_paise).toBe(50_000);
    expect(r.buddy_ban).toBe(true);
  });

  it('hours_until_trip is irrelevant — buddy cancel is full refund regardless', () => {
    const r1 = computeCancellationResolution(baseInputs({ triggerActor: 'buddy', hoursUntilTrip: 1 }));
    const r2 = computeCancellationResolution(baseInputs({ triggerActor: 'buddy', hoursUntilTrip: 100 }));
    expect(r1.tier).toBe('buddy_cancel');
    expect(r2.tier).toBe('buddy_cancel');
    expect(r1.buddy_ban).toBe(true);
    expect(r2.buddy_ban).toBe(true);
  });
});

// ─── Tier: force_majeure ────────────────────────────────────────────────────

describe('force_majeure — ops adjudicates a force-majeure event', () => {
  it('full refund to both sides; no penalties; no ban', () => {
    const r = computeCancellationResolution(baseInputs({
      trigger: 'force_majeure_verified',
      triggerActor: 'system',
      hoursUntilTrip: 5, // even hours <24
      balancePaid: true,
      lateFeePaise: 100_000, // even with late fee assessed
    }));
    expect(r.tier).toBe('force_majeure');
    expect(r.next_booking_status).toBe('cancelled_force_majeure');
    expect(r.traveler_deposit.fate).toBe('refunded');
    expect(r.buddy_deposit.fate).toBe('refunded');
    expect(r.itinerary_buffer.fate).toBe('refunded');
    expect(r.buddy_fee.fate).toBe('refunded');
    expect(r.late_fee.fate).toBe('waived');
    expect(r.buddy_ban).toBe(false);
  });
});

// ─── Tier: platform/system voluntary → force-majeure treatment ──────────────

describe('platform/system voluntary cancellation — force-majeure treatment', () => {
  it.each(['platform', 'system'] as const)(
    '%s actor <24h before trip: full cash refunds, no voucher, no penalty',
    (actor) => {
      const r = computeCancellationResolution(baseInputs({
        triggerActor: actor,
        hoursUntilTrip: 5, // would be the punitive lt_24h tier for a traveler
        balancePaid: true,
        lateFeePaise: 100_000,
      }));
      expect(r.tier).toBe('force_majeure');
      expect(r.next_booking_status).toBe('cancelled_force_majeure');
      expect(r.traveler_deposit.fate).toBe('refunded'); // NOT voucher
      expect(r.buddy_deposit.fate).toBe('refunded');
      expect(r.itinerary_buffer.fate).toBe('refunded');
      expect(r.buddy_fee.fate).toBe('refunded');
      expect(r.late_fee.fate).toBe('waived');
      expect(r.buddy_ban).toBe(false);
    },
  );
});

// ─── Tier: pre_signing (deposit window expired) ─────────────────────────────

describe('pre_signing — deposit window expired before deposits collected', () => {
  it('full refund of any held deposits; no buffer/fee paid', () => {
    const r = computeCancellationResolution(baseInputs({
      currentStatus: 'awaiting_deposits',
      trigger: 'deposit_window_expired',
      triggerActor: 'system',
      hoursUntilTrip: 200,
      travelerDepositHeld: true,
      buddyDepositHeld: false, // only one side paid
      balancePaid: false,
    }));
    expect(r.tier).toBe('pre_signing');
    expect(r.next_booking_status).toBe('cancelled_no_deposit');
    expect(r.traveler_deposit).toEqual({ fate: 'refunded', amount_paise: 50_000 });
    expect(r.buddy_deposit).toEqual({ fate: 'not_paid', amount_paise: 0 });
    expect(r.buddy_ban).toBe(false);
  });
});

// ─── PG fee invariants ─────────────────────────────────────────────────────

describe('PG fee — recorded but borne by platform in v1', () => {
  it('pg_fee_paise = 2% of total refunded; pg_fee_borne_by = platform', () => {
    const r = computeCancellationResolution(baseInputs({ hoursUntilTrip: 100 }));
    // gt_72h with neither balance paid: only deposits refunded = 50_000 + 50_000 = 100_000
    expect(r.pg_fee_paise).toBe(2_000); // 2% of 100_000
    expect(r.pg_fee_borne_by).toBe('platform');
  });

  it('zero PG fee when nothing was refunded (e.g. no deposits held)', () => {
    const r = computeCancellationResolution(baseInputs({
      hoursUntilTrip: 100,
      travelerDepositHeld: false,
      buddyDepositHeld: false,
    }));
    expect(r.pg_fee_paise).toBe(0);
  });
});
