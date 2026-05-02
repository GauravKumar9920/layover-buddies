-- ============================================================================
-- FINANCIAL MODEL — CORE TABLES (Phase 1, Migration 1 of 3)
-- ============================================================================
-- Implements §5 of docs/financial/financial-model-handoff.md.
--
-- Renames vs handoff doc (to avoid colliding with existing schema objects):
--   payouts        → payout_dispatches        (existing `payouts` table is a
--                                              guide-initiated payout REQUEST
--                                              flow; the new one is a per-event
--                                              money DISPATCH ledger keyed by
--                                              booking — different concepts)
--   payout_status  → payout_dispatch_status   (existing enum has 4 different
--                                              values: pending/processing/
--                                              completed/failed)
--   payment_status → payment_event_status     (existing enum is owned by
--                                              bookings.payment_status with 8
--                                              values incl. authorized/captured/
--                                              released)
--
-- Money fields are integer paise. All other amount fields in the existing
-- bookings table remain DECIMAL(10,2) rupees — they will be reconciled in
-- Phase 4 (trip lifecycle). For Phase 1 the new tables coexist alongside.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE agreement_status AS ENUM (
    'draft', 'sent', 'signed_traveler', 'signed_guide', 'fully_signed',
    'cancelled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cost_category AS ENUM (
    'food', 'transport', 'entry', 'activity', 'misc'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE deposit_side AS ENUM ('traveler', 'buddy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE deposit_status AS ENUM ('pending', 'held', 'forfeited', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_kind AS ENUM (
    'deposit', 'balance', 'late_fee', 'top_up', 'refund'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_event_status AS ENUM (
    'initiated', 'captured', 'failed', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payout_kind AS ENUM (
    'trip_pot_release',
    'buddy_fee_final',
    'traveler_refund',
    'cancellation_refund',
    'force_majeure_refund'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payout_dispatch_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- Agreements: the binding doc between traveler and guide
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agreements (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status                      agreement_status NOT NULL DEFAULT 'draft',
  drafted_by_user_id          uuid NOT NULL REFERENCES users(id),  -- always the buddy
  drafted_at                  timestamptz DEFAULT now(),
  sent_at                     timestamptz,
  traveler_signed_at          timestamptz,
  buddy_signed_at             timestamptz,
  cancelled_at                timestamptz,
  cancelled_by_user_id        uuid REFERENCES users(id),
  cancelled_reason            text,
  pdf_url                     text,                                  -- generated PDF in Supabase storage

  -- canonical numbers (all in paise, integer math)
  buddy_fee_paise             integer NOT NULL,                      -- gross, pre-platform-fee
  itinerary_fund_paise        integer NOT NULL,                      -- agreed sum
  buffer_paise                integer NOT NULL,                      -- 20% of itinerary_fund (enforced in app)
  gst_rate                    numeric(5,4) NOT NULL DEFAULT 0.05,

  -- snapshot of derived numbers (recompute on agreement edit before sign)
  traveler_subtotal_paise     integer NOT NULL,                      -- = buddy_fee*1.125 + itinerary + buffer
  traveler_gst_paise          integer NOT NULL,                      -- = subtotal * gst_rate
  traveler_total_paise        integer NOT NULL,                      -- = subtotal + gst + 50000 (deposit)

  trip_starts_at              timestamptz NOT NULL,
  trip_ends_at                timestamptz,                           -- optional, for half-day vs full-day display
  cancellation_terms_version  text NOT NULL DEFAULT 'v1',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreements_booking ON agreements(booking_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status  ON agreements(status);

-- ─────────────────────────────────────────────────────────────────
-- Cost line items: itemized inside an agreement
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_line_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id        uuid NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  category            cost_category NOT NULL,
  description         text NOT NULL,                                  -- "Lunch at Bademiya", "Auto Colaba→Marine Drive"
  estimated_paise     integer NOT NULL,
  position            integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_items_agreement ON cost_line_items(agreement_id, position);

-- ─────────────────────────────────────────────────────────────────
-- Deposits: ₹500 from each side, escrow-held
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deposits (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES users(id),
  side                     deposit_side NOT NULL,
  amount_paise             integer NOT NULL DEFAULT 50000,           -- ₹500
  status                   deposit_status NOT NULL DEFAULT 'pending',
  razorpay_order_id        text,
  razorpay_payment_id      text,
  razorpay_refund_id       text,
  held_at                  timestamptz,
  resolved_at              timestamptz,
  resolution_reason        text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, side)
);

CREATE INDEX IF NOT EXISTS idx_deposits_booking ON deposits(booking_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status  ON deposits(status);

-- ─────────────────────────────────────────────────────────────────
-- Payment events: every traveler-facing money movement
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_events (
  id                                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                           uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id                              uuid NOT NULL REFERENCES users(id),
  kind                                 payment_kind NOT NULL,

  -- amounts: store both INR canonical and original currency
  amount_paise                         integer NOT NULL,             -- INR paise, settled
  original_amount_minor_units          integer,                      -- e.g. USD cents at booking
  original_currency                    text,                         -- 'USD', 'EUR', etc. NULL for INR
  fx_rate_at_capture                   numeric(12,6),                -- INR per unit of original

  status                               payment_event_status NOT NULL DEFAULT 'initiated',
  razorpay_order_id                    text,
  razorpay_payment_id                  text,
  razorpay_signature                   text,
  initiated_at                         timestamptz NOT NULL DEFAULT now(),
  captured_at                          timestamptz,
  failed_reason                        text
);

CREATE INDEX IF NOT EXISTS idx_payment_events_booking ON payment_events(booking_id, kind);

-- ─────────────────────────────────────────────────────────────────
-- Expense proofs: buddy uploads at trip end
-- (Coexists with the unrelated existing `expenses` table. Different shape:
--  expense_proofs requires a UPI screenshot for reconciliation, while
--  expenses is a guide-logged itemized line item with optional bill photo.)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_proofs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  uploaded_by_user_id      uuid NOT NULL REFERENCES users(id),       -- buddy
  category                 cost_category NOT NULL,
  description              text,
  amount_paise             integer NOT NULL,
  bill_url                 text,                                     -- optional
  payment_proof_url        text NOT NULL,                            -- mandatory (UPI screenshot in Supabase storage)
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_proofs_booking ON expense_proofs(booking_id);

-- ─────────────────────────────────────────────────────────────────
-- Payout dispatches: every release of money from escrow
-- (Renamed from handoff's `payouts` to avoid collision with existing
--  guide-payout-request table. The two are conceptually different.)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_dispatches (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  recipient_user_id        uuid NOT NULL REFERENCES users(id),
  kind                     payout_kind NOT NULL,

  -- math broken out for audit
  gross_paise              integer NOT NULL,
  tds_paise                integer NOT NULL DEFAULT 0,
  buffer_clawback_paise    integer NOT NULL DEFAULT 0,
  deposit_component_paise  integer NOT NULL DEFAULT 0,
  net_paise                integer NOT NULL,                          -- = gross - tds - clawback + deposit

  status                   payout_dispatch_status NOT NULL DEFAULT 'pending',
  razorpay_payout_id       text,
  razorpay_fund_account_id text,                                      -- buddy's UPI / bank
  initiated_at             timestamptz NOT NULL DEFAULT now(),
  completed_at             timestamptz,
  failed_reason            text
);

CREATE INDEX IF NOT EXISTS idx_payout_dispatches_booking   ON payout_dispatches(booking_id);
CREATE INDEX IF NOT EXISTS idx_payout_dispatches_recipient ON payout_dispatches(recipient_user_id);
