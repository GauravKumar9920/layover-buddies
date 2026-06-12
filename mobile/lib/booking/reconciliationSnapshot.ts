// ============================================================================
// RECONCILIATION SNAPSHOT — Phase 4 pure math
// ============================================================================
// Mirrors the Postgres `compute_reconciliation_tx` function exactly. Used by:
//   1. Buddy "upload proofs" preview ("here's what will happen on submit").
//   2. Receipt screens (renders the persisted payout_dispatches alongside the
//      headline numbers from this snapshot).
//   3. Unit tests asserting parity with the canonical fixture (₹2,032.50
//      buddy net + ₹700 traveler refund per the worked example in handoff §2).
//
// Critical: the formulas here must EXACTLY match the plpgsql function. The
// test suite asserts both produce identical numbers for the canonical fixture.
// If you change the math here, change it in 20260512100200_reconciliation_function.sql
// in the same commit.
// ============================================================================

import {
  DEPOSIT_PAISE,
  TDS_RATE,
  PLATFORM_FEE_DOWN_RATE,
} from '@/config/constants';

export interface ReconciliationInputs {
  /** Gross buddy fee (pre-platform-fee) in paise. From agreements.buddy_fee_paise. */
  buddyFeePaise: number;
  /** Itinerary fund in paise. From agreements.itinerary_fund_paise. */
  itineraryFundPaise: number;
  /** Buffer in paise (20% of itinerary). From agreements.buffer_paise. */
  bufferPaise: number;
  /** Sum of captured top-ups for the booking (paise). 0 if none. */
  capturedTopUpsPaise: number;
  /** Sum of all expense_proofs.amount_paise for the booking. */
  declaredSpendPaise: number;
  /**
   * Buddy-side platform fee rate snapshotted on the agreement
   * (`agreements.platform_fee_down_rate`). 0 for early-access agreements.
   * Defaults to the historical 12.5% for back-compat.
   */
  platformFeeDownRate?: number;
  /**
   * TDS rate snapshotted on the agreement (`agreements.tds_rate`).
   * 0 for early-access agreements. Defaults to the historical 1%.
   */
  tdsRate?: number;
}

export interface ReconciliationSnapshot {
  /** itinerary + buffer + topups */
  tripPotPaise: number;
  /** min(declaredSpend, tripPot) — caps over-spend per §12 case 5 */
  declaredSpendCappedPaise: number;
  /** tripPot − declaredSpendCapped */
  unusedBufferPaise: number;
  /** floor(buddyFee × (1 − platformFeeDownRate)) — buddy fee after platform-down */
  buddyFeeAfterPlatformPaise: number;
  /** round(buddyFeeAfterPlatform × tdsRate) — Section 194C TDS */
  tdsPaise: number;
  /** afterPlatform − tds + ₹500 deposit refund − unused buffer */
  buddyNetPaise: number;
  /** unused buffer + ₹500 deposit refund */
  travelerRefundPaise: number;
}

/** Thrown when an input is not a non-negative finite integer. */
export class InvalidReconciliationInputError extends Error {
  constructor(field: string, value: number) {
    super(`Invalid reconciliation input for ${field}: ${value} (must be a non-negative integer in paise)`);
    this.name = 'InvalidReconciliationInputError';
  }
}

function assertPaise(field: string, v: number): void {
  if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    throw new InvalidReconciliationInputError(field, v);
  }
}

/**
 * Compute the reconciliation snapshot. Pure: same inputs always produce the
 * same outputs; throws on invariant violation rather than silently coercing.
 *
 * Canonical fixture: buddyFee=200_000, itin=300_000, buffer=60_000,
 * topUps=0, declared=340_000 → buddyNet=203_250 (₹2,032.50),
 * travelerRefund=70_000 (₹700).
 */
export function computeReconciliationSnapshot(
  inputs: ReconciliationInputs,
): ReconciliationSnapshot {
  assertPaise('buddyFeePaise',         inputs.buddyFeePaise);
  assertPaise('itineraryFundPaise',    inputs.itineraryFundPaise);
  assertPaise('bufferPaise',           inputs.bufferPaise);
  assertPaise('capturedTopUpsPaise',   inputs.capturedTopUpsPaise);
  assertPaise('declaredSpendPaise',    inputs.declaredSpendPaise);

  const tripPotPaise =
    inputs.itineraryFundPaise + inputs.bufferPaise + inputs.capturedTopUpsPaise;

  // §12 case 5 — over-spend is silently capped at the trip pot.
  const declaredSpendCappedPaise = Math.min(
    inputs.declaredSpendPaise,
    tripPotPaise,
  );

  const unusedBufferPaise = tripPotPaise - declaredSpendCappedPaise;

  const platformFeeDownRate = inputs.platformFeeDownRate ?? PLATFORM_FEE_DOWN_RATE;
  const tdsRate             = inputs.tdsRate ?? TDS_RATE;
  if (!Number.isFinite(platformFeeDownRate) || platformFeeDownRate < 0 || platformFeeDownRate > 1) {
    throw new InvalidReconciliationInputError('platformFeeDownRate', platformFeeDownRate);
  }
  if (!Number.isFinite(tdsRate) || tdsRate < 0 || tdsRate > 1) {
    throw new InvalidReconciliationInputError('tdsRate', tdsRate);
  }

  // Platform-down on the buddy fee (0 for early-access agreements).
  const buddyFeeAfterPlatformPaise = Math.floor(
    inputs.buddyFeePaise * (1 - platformFeeDownRate),
  );

  // Section 194C TDS on the post-platform amount (0 for early-access agreements).
  const tdsPaise = Math.round(buddyFeeAfterPlatformPaise * tdsRate);

  // Buddy net = (fee × 0.875) − TDS + 500 deposit refund − unused buffer
  const buddyNetPaise =
    buddyFeeAfterPlatformPaise - tdsPaise + DEPOSIT_PAISE - unusedBufferPaise;

  // Traveler refund = unused buffer + 500 deposit refund
  const travelerRefundPaise = unusedBufferPaise + DEPOSIT_PAISE;

  return {
    tripPotPaise,
    declaredSpendCappedPaise,
    unusedBufferPaise,
    buddyFeeAfterPlatformPaise,
    tdsPaise,
    buddyNetPaise,
    travelerRefundPaise,
  };
}
