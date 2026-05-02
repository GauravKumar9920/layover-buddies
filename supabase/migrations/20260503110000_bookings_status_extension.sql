-- ============================================================================
-- BOOKINGS STATUS EXTENSION (Phase 1, Migration 2 of 3)
-- ============================================================================
-- Adds the 18 new booking_status enum values from §3 of the financial-model
-- handoff plus four new bookings columns for the OTP/QR scan flow.
--
-- Data migration is split into a SEPARATE follow-on file
-- (20260503110100_bookings_status_data_migration.sql) because PostgreSQL
-- forbids referencing newly-added enum values in the same transaction in
-- which they're created.
-- ============================================================================

-- New booking_status enum values (additive — IF NOT EXISTS keeps it idempotent)
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'chat_open';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'agreement_drafting';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'agreement_sent';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'agreement_signed_traveler';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'agreement_signed_buddy';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'awaiting_deposits';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'deposits_held';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'awaiting_balance';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'late_fee_due';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'balance_paid';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'trip_ready';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'awaiting_proofs';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'reconciling';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'rated';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancelled_no_pay';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancelled_traveler_voluntary';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancelled_buddy';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancelled_force_majeure';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancelled_pre_signing';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancelled_no_deposit';

-- OTP/QR fields on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trip_qr_token              text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trip_qr_scanned_at         timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trip_qr_scanned_by_user_id uuid REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ended_by_buddy_at          timestamptz;
