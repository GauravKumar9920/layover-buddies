// ============================================================================
// CANCELLATION SNAPSHOT — Phase 3 pure truth-table
// ============================================================================
// Mirrors the Postgres `compute_cancellation_resolution_tx` function exactly.
// Used by:
//   1. Pre-confirm preview ("Here's what you'll get refunded if you cancel now").
//   2. Receipt screens — renders the persisted JSONB structure.
//   3. Unit tests asserting parity with the §7 truth table.
//
// Critical: the truth table here must EXACTLY match the plpgsql function.
// See 20260512100300_cancellation_function.sql.
// ============================================================================

import { DEPOSIT_PAISE, PG_FEE_RATE, PLATFORM_CREDIT_PAISE } from '@/config/constants';
import type { BookingState } from './stateMachine';

export type CancellationTrigger =
  | 'voluntary'              // either party tapped "Cancel"
  | 't_minus_12_no_pay'      // cron fired: late_fee_due hit T-12h without payment
  | 'force_majeure_verified' // ops adjudicated a force-majeure event
  | 'deposit_window_expired'; // cron fired: awaiting_deposits aged > 24h

export type CancellationActor = 'traveler' | 'buddy' | 'system';

export type CancellationTier =
  | 'gt_72h'
  | '24_to_72h'
  | 'lt_24h'
  | 'late_no_pay'
  | 'buddy_cancel'
  | 'force_majeure'
  | 'pre_signing';

/** Fate of an amount in the resolution. */
export type AmountFate =
  | 'refunded'   // money returned to the original payer
  | 'forfeited'  // money kept by counterparty or platform
  | 'voucher'    // credited as a 30-day platform voucher (placeholder in v1)
  | 'waived'     // never charged; no money to move
  | 'not_paid';  // amount was never collected

export interface AmountComponent {
  fate: AmountFate;
  amount_paise: number;
  /** For voucher fate, how much of the amount becomes a 30-day credit (placeholder in v1). */
  voucher_paise?: number;
}

export interface CancellationResolution {
  trigger: CancellationTrigger;
  trigger_actor: CancellationActor;
  tier: CancellationTier;
  hours_until_trip: number;
  traveler_deposit: AmountComponent;
  buddy_deposit:    AmountComponent;
  itinerary_buffer: AmountComponent;
  buddy_fee:        AmountComponent;
  late_fee:         AmountComponent;
  platform_credit: {
    issue_to_user_id: string | null;
    amount_paise:     number;
  };
  /** Razorpay PG fee (~2%) — recorded but borne by platform in v1. */
  pg_fee_paise:     number;
  pg_fee_borne_by:  'platform' | 'traveler' | 'buddy';
  /** Whether the buddy gets banned (true only for buddy_cancel tier). */
  buddy_ban: boolean;
  /** The next booking state to write. */
  next_booking_status: BookingState;
}

export interface CancellationInputs {
  currentStatus:       BookingState;
  trigger:             CancellationTrigger;
  triggerActor:        CancellationActor;
  hoursUntilTrip:      number;
  /** Whether the traveler deposit is held. From deposits[traveler].status. */
  travelerDepositHeld: boolean;
  /** Whether the buddy deposit is held. From deposits[buddy].status. */
  buddyDepositHeld:    boolean;
  /** Whether the balance has been captured. From payment_events. */
  balancePaid:         boolean;
  /** Buddy fee in paise (post-platform). For buddy_cancel refund of full fee. */
  buddyFeePaise:       number;
  /** Itinerary fund + buffer in paise. */
  tripPotPaise:        number;
  /** Late fee assessed, if any. */
  lateFeePaise:        number;
  /** Booking IDs for the platform_credit issuance target. */
  travelerUserId:      string;
}

const REFUNDED = (amount: number): AmountComponent => ({ fate: 'refunded', amount_paise: amount });
const FORFEITED = (amount: number): AmountComponent => ({ fate: 'forfeited', amount_paise: amount });
const VOUCHER = (amount: number, voucher: number): AmountComponent => ({
  fate: 'voucher', amount_paise: amount, voucher_paise: voucher,
});
const WAIVED: AmountComponent = { fate: 'waived', amount_paise: 0 };
const NOT_PAID: AmountComponent = { fate: 'not_paid', amount_paise: 0 };

/**
 * Compute the cancellation resolution per §7. Pure: deterministic given inputs.
 */
export function computeCancellationResolution(
  inputs: CancellationInputs,
): CancellationResolution {
  const {
    currentStatus,
    trigger,
    triggerActor,
    hoursUntilTrip,
    travelerDepositHeld,
    buddyDepositHeld,
    balancePaid,
    buddyFeePaise,
    tripPotPaise,
    lateFeePaise,
    travelerUserId,
  } = inputs;

  // ── Determine the tier ─────────────────────────────────────────────────────
  let tier: CancellationTier;
  let nextStatus: BookingState;

  if (trigger === 'force_majeure_verified') {
    tier = 'force_majeure';
    nextStatus = 'cancelled_force_majeure';
  } else if (trigger === 'deposit_window_expired') {
    tier = 'pre_signing';
    nextStatus = 'cancelled_no_deposit';
  } else if (trigger === 't_minus_12_no_pay') {
    tier = 'late_no_pay';
    nextStatus = 'cancelled_no_pay';
  } else if (triggerActor === 'buddy') {
    tier = 'buddy_cancel';
    nextStatus = 'cancelled_buddy';
  } else if (triggerActor === 'traveler') {
    if (hoursUntilTrip > 72) tier = 'gt_72h';
    else if (hoursUntilTrip >= 24) tier = '24_to_72h';
    else tier = 'lt_24h';
    nextStatus = 'cancelled_traveler_voluntary';
  } else {
    // System-initiated voluntary cancellations are treated as traveler-side
    // for refund purposes (e.g. ops cleanup of stale chats). >72h tier.
    tier = 'gt_72h';
    nextStatus = 'cancelled_traveler_voluntary';
  }

  // ── Resolve each component per the truth table ──────────────────────────
  let travelerDeposit: AmountComponent = NOT_PAID;
  let buddyDeposit:    AmountComponent = NOT_PAID;
  let itineraryBuffer: AmountComponent = NOT_PAID;
  let buddyFee:        AmountComponent = NOT_PAID;
  let lateFee:         AmountComponent = WAIVED;
  let platformCreditUserId: string | null = null;
  let platformCreditPaise: number = 0;
  let buddyBan: boolean = false;

  switch (tier) {
    case 'gt_72h':
    case 'pre_signing':
      // Full refund of held amounts; no buffer/fee paid yet.
      travelerDeposit = travelerDepositHeld ? REFUNDED(DEPOSIT_PAISE) : NOT_PAID;
      buddyDeposit    = buddyDepositHeld    ? REFUNDED(DEPOSIT_PAISE) : NOT_PAID;
      itineraryBuffer = balancePaid ? REFUNDED(tripPotPaise) : NOT_PAID;
      buddyFee        = balancePaid ? REFUNDED(buddyFeePaise) : NOT_PAID;
      break;

    case '24_to_72h': {
      // 50% refund of traveler deposit + buffer (if paid). Buddy deposit refunded.
      const halfDeposit = Math.floor(DEPOSIT_PAISE / 2);
      travelerDeposit = travelerDepositHeld
        ? { fate: 'refunded', amount_paise: halfDeposit }
        : NOT_PAID;
      buddyDeposit    = buddyDepositHeld ? REFUNDED(DEPOSIT_PAISE) : NOT_PAID;
      itineraryBuffer = balancePaid
        ? { fate: 'refunded', amount_paise: Math.floor(tripPotPaise / 2) }
        : NOT_PAID;
      buddyFee = balancePaid
        ? { fate: 'refunded', amount_paise: Math.floor(buddyFeePaise / 2) }
        : NOT_PAID;
      break;
    }

    case 'lt_24h':
      // Forfeited / voucher placeholder. Buddy still gets deposit back.
      travelerDeposit = travelerDepositHeld
        ? VOUCHER(DEPOSIT_PAISE, DEPOSIT_PAISE)
        : NOT_PAID;
      buddyDeposit    = buddyDepositHeld ? REFUNDED(DEPOSIT_PAISE) : NOT_PAID;
      itineraryBuffer = balancePaid ? VOUCHER(tripPotPaise, tripPotPaise) : NOT_PAID;
      buddyFee        = balancePaid ? VOUCHER(buddyFeePaise, buddyFeePaise) : NOT_PAID;
      break;

    case 'late_no_pay':
      // Traveler forfeits deposit. Late fee accrued but not collected → forfeit.
      travelerDeposit = travelerDepositHeld ? FORFEITED(DEPOSIT_PAISE) : NOT_PAID;
      buddyDeposit    = buddyDepositHeld    ? REFUNDED(DEPOSIT_PAISE) : NOT_PAID;
      // Balance never paid in this tier.
      lateFee = lateFeePaise > 0 ? FORFEITED(lateFeePaise) : WAIVED;
      break;

    case 'buddy_cancel':
      // Full refund to traveler. Buddy forfeits deposit + gets banned.
      travelerDeposit = travelerDepositHeld ? REFUNDED(DEPOSIT_PAISE) : NOT_PAID;
      buddyDeposit    = buddyDepositHeld    ? FORFEITED(DEPOSIT_PAISE) : NOT_PAID;
      itineraryBuffer = balancePaid ? REFUNDED(tripPotPaise) : NOT_PAID;
      buddyFee        = balancePaid ? REFUNDED(buddyFeePaise) : NOT_PAID;
      lateFee         = WAIVED;
      // ₹500 platform credit to the traveler (recorded; not issued in v1)
      platformCreditUserId = travelerUserId;
      platformCreditPaise  = PLATFORM_CREDIT_PAISE;
      buddyBan = true;
      break;

    case 'force_majeure':
      // Full refund to both sides; no penalties.
      travelerDeposit = travelerDepositHeld ? REFUNDED(DEPOSIT_PAISE) : NOT_PAID;
      buddyDeposit    = buddyDepositHeld    ? REFUNDED(DEPOSIT_PAISE) : NOT_PAID;
      itineraryBuffer = balancePaid ? REFUNDED(tripPotPaise) : NOT_PAID;
      buddyFee        = balancePaid ? REFUNDED(buddyFeePaise) : NOT_PAID;
      lateFee         = WAIVED;
      break;
  }

  // PG fee is computed on every cash-moving component but borne by the platform in v1.
  const totalRefundedPaise = [
    travelerDeposit, buddyDeposit, itineraryBuffer, buddyFee,
  ].reduce((sum, c) => sum + (c.fate === 'refunded' ? c.amount_paise : 0), 0);

  return {
    trigger,
    trigger_actor: triggerActor,
    tier,
    hours_until_trip: hoursUntilTrip,
    traveler_deposit: travelerDeposit,
    buddy_deposit: buddyDeposit,
    itinerary_buffer: itineraryBuffer,
    buddy_fee: buddyFee,
    late_fee: lateFee,
    platform_credit: {
      issue_to_user_id: platformCreditUserId,
      amount_paise: platformCreditPaise,
    },
    pg_fee_paise: Math.round(totalRefundedPaise * PG_FEE_RATE),
    pg_fee_borne_by: 'platform',
    buddy_ban: buddyBan,
    next_booking_status: nextStatus,
  };
}
