// ============================================================================
// AGREEMENT SNAPSHOT — pure function used by drafting UI, sendAgreement, tests
// ============================================================================
// Computes the denormalised pricing snapshot persisted into `agreements`
// (traveler_subtotal_paise, traveler_gst_paise, traveler_total_paise) from
// the four canonical inputs (buddy fee, itinerary fund, buffer, GST rate).
//
// These numbers MUST exactly match the worked example in
// docs/financial/financial-model-handoff.md §2 and the constants in
// mobile/lib/booking/__fixtures__/canonical.ts. The Phase 1 fixture asserts
// `travelerTotalPaise === 664_250` (₹6,642.50) given canonical inputs;
// `agreementSnapshot.test.ts` asserts the same against this function.
// ============================================================================

import { DEPOSIT_PAISE, BUFFER_PERCENT, PLATFORM_FEE_UP_RATE } from '@/config/constants';

export interface AgreementInputs {
  /** Gross buddy fee in paise (pre-platform-up). */
  buddyFeePaise: number;
  /** Agreed day-spend fund in paise. */
  itineraryFundPaise: number;
  /** Buffer in paise — must equal floor(itinerary × 0.20). */
  bufferPaise: number;
  /** GST rate as a decimal (e.g. 0.05 for 5%). */
  gstRate: number;
  /**
   * Traveler-side platform fee rate as a decimal (e.g. 0.125 for 12.5%).
   * 0 during early access. When rendering an EXISTING agreement, pass the
   * rate snapshotted on its row (`agreements.platform_fee_up_rate`); when
   * drafting a NEW one, pass the effective rate from platformSettings.
   * Defaults to the historical 12.5% for back-compat.
   */
  platformFeeUpRate?: number;
}

export interface AgreementSnapshot {
  /** Traveler-view buddy fee = buddy fee × (1 + platformFeeUpRate). */
  buddyFeeTravelerViewPaise: number;
  /** Subtotal that GST is computed on. */
  travelerSubtotalPaise: number;
  /** GST = subtotal × gstRate. */
  travelerGstPaise: number;
  /** Total the traveler pays = subtotal + GST + ₹500 deposit. */
  travelerTotalPaise: number;
}

/** Thrown when the buffer doesn't satisfy the floor(itinerary × 0.20) invariant. */
export class InvalidBufferError extends Error {
  constructor(itineraryFundPaise: number, bufferPaise: number) {
    const expected = Math.floor(itineraryFundPaise * BUFFER_PERCENT);
    super(
      `Invalid buffer: expected ${expected} paise (20% of ${itineraryFundPaise}), got ${bufferPaise}`,
    );
    this.name = 'InvalidBufferError';
  }
}

/** Thrown when a numeric input is not a non-negative finite integer. */
export class InvalidAmountError extends Error {
  constructor(field: string, value: number) {
    super(`Invalid amount for ${field}: ${value} (must be a non-negative integer in paise)`);
    this.name = 'InvalidAmountError';
  }
}

function assertPaise(field: string, v: number): void {
  if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    throw new InvalidAmountError(field, v);
  }
}

/**
 * Compute the agreement snapshot from canonical inputs. Pure: same inputs
 * always produce the same outputs; throws on invariant violation rather than
 * silently coercing.
 */
export function computeAgreementSnapshot(inputs: AgreementInputs): AgreementSnapshot {
  assertPaise('buddyFeePaise', inputs.buddyFeePaise);
  assertPaise('itineraryFundPaise', inputs.itineraryFundPaise);
  assertPaise('bufferPaise', inputs.bufferPaise);

  if (!Number.isFinite(inputs.gstRate) || inputs.gstRate < 0 || inputs.gstRate > 1) {
    throw new InvalidAmountError('gstRate', inputs.gstRate);
  }

  const platformFeeUpRate = inputs.platformFeeUpRate ?? PLATFORM_FEE_UP_RATE;
  if (!Number.isFinite(platformFeeUpRate) || platformFeeUpRate < 0 || platformFeeUpRate > 1) {
    throw new InvalidAmountError('platformFeeUpRate', platformFeeUpRate);
  }

  // Buffer invariant — must match the DB CHECK constraint exactly.
  const expectedBuffer = Math.floor(inputs.itineraryFundPaise * BUFFER_PERCENT);
  if (inputs.bufferPaise !== expectedBuffer) {
    throw new InvalidBufferError(inputs.itineraryFundPaise, inputs.bufferPaise);
  }

  // Platform-up on the traveler's view of the buddy fee (0 during early access).
  const buddyFeeTravelerViewPaise = Math.round(inputs.buddyFeePaise * (1 + platformFeeUpRate));

  const travelerSubtotalPaise =
    buddyFeeTravelerViewPaise + inputs.itineraryFundPaise + inputs.bufferPaise;

  const travelerGstPaise = Math.round(travelerSubtotalPaise * inputs.gstRate);

  const travelerTotalPaise = travelerSubtotalPaise + travelerGstPaise + DEPOSIT_PAISE;

  return {
    buddyFeeTravelerViewPaise,
    travelerSubtotalPaise,
    travelerGstPaise,
    travelerTotalPaise,
  };
}
