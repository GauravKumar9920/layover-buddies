// ============================================================================
// CANONICAL AGREEMENT FIXTURE — §2 of docs/financial/financial-model-handoff.md
// ============================================================================
// Single source of truth for the worked-example numbers. Every component that
// deals with financial math (pricing UI, reconciler, tests) imports from here
// so they all reproduce the exact same rupee amounts.
//
// Buddy fee ₹2,000 · Itinerary fund ₹3,000 · Buffer ₹600
//   → traveler total ₹6,642.50   → buddy net payout ₹2,032.50
// ============================================================================

/** Raw inputs from the signed agreement (all amounts in integer paise). */
export const CANONICAL_AGREEMENT_INPUTS = {
  buddyFeePaise:       200_000, // ₹2,000  — gross buddy fee, pre-platform deduction
  itineraryFundPaise:  300_000, // ₹3,000  — agreed trip-day fund for both parties
  bufferPaise:          60_000, // ₹600    — 20% of itinerary fund (enforced by app)
  gstRate:               0.05,  // 5%      — Tour Operator HSN 9985, no ITC
  depositPaise:         50_000, // ₹500    — refundable escrow deposit per side
} as const;

/**
 * Derived numbers (computed once from the inputs above).
 * Phase 2 pricing UI and Phase 3 reconciler must reproduce these exactly.
 */
export const CANONICAL_DERIVED = {
  // ── Traveler-facing ─────────────────────────────────────────────────────────
  buddyFeeTravelerViewPaise: 225_000, // 200_000 × 1.125  (gross + 12.5% platform-up)
  travelerSubtotalPaise:     585_000, // 225_000 + 300_000 + 60_000  (GST-able base)
  travelerGstPaise:           29_250, // 585_000 × 0.05
  travelerTotalPaise:        664_250, // 585_000 + 29_250 + 50_000   → ₹6,642.50

  // ── Buddy-facing (assume ₹3,400 of ₹3,600 trip pot spent) ──────────────────
  tripPotPaise:              360_000, // itineraryFund + buffer = 300_000 + 60_000
  spentPaise:                340_000, // assumed spend in worked example
  unusedBufferPaise:          20_000, // 360_000 − 340_000

  buddyFeeNetPaise:          175_000, // 200_000 × 0.875  (post 12.5% platform-down)
  tdsPaise:                    1_750, // 175_000 × 0.01   (Section 194C TDS)
  buddyDepositRefundPaise:    50_000, // ₹500 escrow refund

  // net_to_buddy = (buddy_fee × 0.875) − TDS + deposit − unused_buffer
  buddyNetPayoutPaise:       203_250, // 175_000 − 1_750 + 50_000 − 20_000   → ₹2,032.50

  // ── Traveler refund at trip end ─────────────────────────────────────────────
  travelerRefundAtEndPaise:   70_000, // unusedBuffer + deposit = 20_000 + 50_000

  // ── Platform unit economics ──────────────────────────────────────────────────
  platformFeePaise:           50_000, // 25% × 200_000 buddy fee
} as const;
