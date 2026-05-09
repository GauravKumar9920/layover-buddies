// Business rules — never change without founder sign-off
export const COMMISSION_RATE = 0.25; // 25% of buddy_cost only (NOT on expenses)
// NOTE: NEXT_TASKS.md Task 7 suggests 15% — confirm with Gaurav before changing

export const ESTIMATED_EXPENSES_PERCENT = 30; // 30% of buddy_cost as placeholder estimate
export const MIN_BOOKING_NOTICE_HOURS = 4;    // can't book less than 4h before arrival
export const MAX_BOOKING_ADVANCE_DAYS = 90;   // can't book more than 90 days ahead

export const CURRENCY = 'INR' as const;
export const CURRENCY_SYMBOL = '₹' as const;

// ── Phase 2 financial-model constants ───────────────────────────────────────
// All amounts in integer paise (1 INR = 100 paise) per the financial-model
// handoff §2. The ₹500 deposit and 20% buffer are LOCKED — they're enforced
// in the DB by CHECK constraints (migration 20260510100000_agreement_invariants)
// and by the agreement-snapshot helper.
export const DEPOSIT_PAISE = 50_000;     // ₹500 refundable deposit per side
export const BUFFER_PERCENT = 0.20;      // 20% of itinerary fund

// ── Phase 3 — balance, late fees, cancellations ─────────────────────────────
export const LATE_FEE_PAISE         = 100_000;  // ₹1,000 fixed late fee
export const TDS_RATE               = 0.01;     // Section 194C — 1% on buddy fee
export const PLATFORM_FEE_DOWN_RATE = 0.125;    // 12.5% buddy-side platform-down
export const PLATFORM_FEE_UP_RATE   = 0.125;    // 12.5% traveler-side platform-up (mirror)
export const T_MINUS_72_HOURS       = 72;       // late-fee accrual cutoff
export const T_MINUS_12_HOURS       = 12;       // no-pay cancel + trip-ready promotion
export const BALANCE_REMINDER_HOURS = [84, 48, 24, 18] as const;
export const PG_FEE_RATE            = 0.02;     // Razorpay PG fee — recorded but borne by platform in v1

// ── Phase 4 — trip lifecycle, top-ups, reconciliation ───────────────────────
export const PROOFS_DUE_HOURS       = 24;       // buddy has 24h post-trip to upload proofs
export const TOP_UP_EXPIRY_MINUTES  = 15;       // traveler has 15 min to decide on a top-up
export const RATING_LINK_HOURS      = 3;        // T+3h post-completion → rating link sent
export const PLATFORM_CREDIT_PAISE  = 50_000;   // ₹500 platform credit on buddy-cancellation

export const BOOKING_STATUS = {
  PENDING: 'pending',
  GUIDE_ACCEPTED: 'guide_accepted',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  // 'declined' was never in the DB enum (latent bug — fixed in migration
  // 20260503110100_bookings_status_data_migration.sql).
  // Any rows with that value are remapped to cancelled_pre_signing on deploy.
  CANCELLED_PRE_SIGNING: 'cancelled_pre_signing',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  RELEASED: 'released',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

// Guides only show in search if rating >= this (0 reviews are exempt — shown as "New Guide")
export const MIN_GUIDE_RATING = 4.0;

// Payment held in escrow; auto-released after this many hours post-tour
export const ESCROW_RELEASE_HOURS = 24;

export const PRIMARY_CITY = 'Mumbai' as const;

export const SUPPORTED_CITIES = [
  PRIMARY_CITY,
] as const;

export const GUIDE_CATEGORIES = [
  'History',
  'Culture',
  'Food',
  'Photography',
  'Art',
  'Nature',
  'Adventure',
  'Shopping',
] as const;

export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  History: { bg: '#EDE9FE', text: '#6C5CE7' },
  Culture: { bg: '#FCE7F3', text: '#DB2777' },
  Food: { bg: '#FEF3C7', text: '#D97706' },
  Photography: { bg: '#DBEAFE', text: '#2563EB' },
  Art: { bg: '#FEF9C3', text: '#CA8A04' },
  Nature: { bg: '#DCFCE7', text: '#16A34A' },
  Adventure: { bg: '#FEE2E2', text: '#DC2626' },
  Shopping: { bg: '#F3E8FF', text: '#9333EA' },
};
