-- ============================================================================
-- RLS FIXES — Missing policies found during smoke test (2026-04-14)
-- ============================================================================

-- 1. itinerary_stops: travelers couldn't see stops on published itineraries
--    (only guide-owned-stops policy existed)
CREATE POLICY "Everyone can read stops of published itineraries" ON itinerary_stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE id = itinerary_stops.itinerary_id
        AND is_published = true
    )
  );

-- 2. bookings: no UPDATE policy existed — guides couldn't accept/decline,
--    travelers couldn't cancel
CREATE POLICY "Guides can update own bookings" ON bookings
  FOR UPDATE USING (auth.uid() = guide_id);

CREATE POLICY "Travelers can update own bookings" ON bookings
  FOR UPDATE USING (auth.uid() = traveler_id);

-- 3. messages: no UPDATE policy — markMessagesRead (is_read flag) was blocked
CREATE POLICY "Users can mark messages as read" ON messages
  FOR UPDATE
  USING (
    booking_id IN (
      SELECT id FROM bookings
      WHERE traveler_id = auth.uid() OR guide_id = auth.uid()
    )
    AND sender_id != auth.uid()
  )
  WITH CHECK (
    booking_id IN (
      SELECT id FROM bookings
      WHERE traveler_id = auth.uid() OR guide_id = auth.uid()
    )
  );

-- 4. Extend payment_status enum to include Razorpay lifecycle values
--    DB had: pending, paid, refunded, partial_refund
--    Code uses: authorized, captured, released, failed (Razorpay-style)
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'authorized';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'captured';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'released';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed';
