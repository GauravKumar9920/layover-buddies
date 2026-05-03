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

import { DEPOSIT_PAISE, BUFFER_PERCENT } from '@/config/constants';

export interface AgreementInputs {
  /** Gross buddy fee in paise (pre-platform-up). */
  buddyFeePaise: number;
  /** Agreed day-spend fund in paise. */
  itineraryFundPaise: number;
  /** Buffer in paise — must equal floor(itinerary × 0.20). */
  bufferPaise: number;
  /** GST rate as a decimal (e.g. 0.05 for 5%). */
  gstRate: number;
}

export interface AgreementSnapshot {
  /** Traveler-view buddy fee = buddy fee × 1.125 (12.5% platform-up). */
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

  // Buffer invariant — must match the DB CHECK constraint exactly.
  const expectedBuffer = Math.floor(inputs.itineraryFundPaise * BUFFER_PERCENT);
  if (inputs.bufferPaise !== expectedBuffer) {
    throw new InvalidBufferError(inputs.itineraryFundPaise, inputs.bufferPaise);
  }

  // 12.5% platform-up on the traveler's view of the buddy fee.
  const buddyFeeTravelerViewPaise = Math.round(inputs.buddyFeePaise * 1.125);

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
