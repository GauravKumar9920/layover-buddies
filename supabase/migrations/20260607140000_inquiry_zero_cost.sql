-- ============================================================================
-- Allow zero-cost inquiry bookings
-- ============================================================================
-- Inquiry-first flow: a booking can be created as a casual inquiry (status
-- chat_open) with no package selected yet, so buddy_cost / total_amount are 0
-- until the itinerary + price are agreed in chat. The original CHECK
-- constraints required > 0, which rejected those rows. Relax to >= 0 (still
-- NOT NULL, so a real priced booking can't go negative or null).
-- ============================================================================

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS cost_valid;
ALTER TABLE bookings ADD  CONSTRAINT cost_valid CHECK (buddy_cost >= 0);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS total_amount_valid;
ALTER TABLE bookings ADD  CONSTRAINT total_amount_valid CHECK (total_amount >= 0);
