-- ============================================================================
-- RLS POLICY COVERAGE HARDENING (2026-04-18)
-- Adds missing/partial policies for tables that already had RLS enabled.
-- ============================================================================

-- --------------------------------------------------------------------------
-- traveler_profiles
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own traveler profile" ON traveler_profiles;
CREATE POLICY "Users can read own traveler profile" ON traveler_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Guides can read traveler profiles from own bookings" ON traveler_profiles;
CREATE POLICY "Guides can read traveler profiles from own bookings" ON traveler_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.traveler_id = traveler_profiles.user_id
        AND b.guide_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own traveler profile" ON traveler_profiles;
CREATE POLICY "Users can create own traveler profile" ON traveler_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own traveler profile" ON traveler_profiles;
CREATE POLICY "Users can update own traveler profile" ON traveler_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- itineraries
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read accessible itineraries" ON itineraries;
CREATE POLICY "Users can read accessible itineraries" ON itineraries
  FOR SELECT USING (
    is_published = true
    OR auth.uid() = guide_id
    OR EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.itinerary_id = itineraries.id
        AND auth.uid() IN (b.traveler_id, b.guide_id)
    )
  );

DROP POLICY IF EXISTS "Guides can create own itineraries" ON itineraries;
CREATE POLICY "Guides can create own itineraries" ON itineraries
  FOR INSERT WITH CHECK (
    auth.uid() = guide_id
    AND EXISTS (
      SELECT 1
      FROM guide_profiles gp
      WHERE gp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Guides can update own itineraries" ON itineraries;
CREATE POLICY "Guides can update own itineraries" ON itineraries
  FOR UPDATE
  USING (auth.uid() = guide_id)
  WITH CHECK (auth.uid() = guide_id);

DROP POLICY IF EXISTS "Guides can delete own itineraries" ON itineraries;
CREATE POLICY "Guides can delete own itineraries" ON itineraries
  FOR DELETE USING (auth.uid() = guide_id);

-- --------------------------------------------------------------------------
-- itinerary_stops (adds missing write policies + broader read access)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read accessible itinerary stops" ON itinerary_stops;
CREATE POLICY "Users can read accessible itinerary stops" ON itinerary_stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM itineraries i
      WHERE i.id = itinerary_stops.itinerary_id
        AND (
          i.is_published = true
          OR i.guide_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM bookings b
            WHERE b.itinerary_id = i.id
              AND auth.uid() IN (b.traveler_id, b.guide_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Guides can create stops for own itineraries" ON itinerary_stops;
CREATE POLICY "Guides can create stops for own itineraries" ON itinerary_stops
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM itineraries i
      WHERE i.id = itinerary_stops.itinerary_id
        AND i.guide_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Guides can update stops for own itineraries" ON itinerary_stops;
CREATE POLICY "Guides can update stops for own itineraries" ON itinerary_stops
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM itineraries i
      WHERE i.id = itinerary_stops.itinerary_id
        AND i.guide_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM itineraries i
      WHERE i.id = itinerary_stops.itinerary_id
        AND i.guide_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Guides can delete stops for own itineraries" ON itinerary_stops;
CREATE POLICY "Guides can delete stops for own itineraries" ON itinerary_stops
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM itineraries i
      WHERE i.id = itinerary_stops.itinerary_id
        AND i.guide_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- match_requests
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own match requests" ON match_requests;
CREATE POLICY "Users can read own match requests" ON match_requests
  FOR SELECT USING (auth.uid() = traveler_id OR auth.uid() = guide_id);

DROP POLICY IF EXISTS "Travelers can create match requests" ON match_requests;
CREATE POLICY "Travelers can create match requests" ON match_requests
  FOR INSERT WITH CHECK (auth.uid() = traveler_id);

DROP POLICY IF EXISTS "Users can update own match requests" ON match_requests;
CREATE POLICY "Users can update own match requests" ON match_requests
  FOR UPDATE
  USING (auth.uid() = traveler_id OR auth.uid() = guide_id)
  WITH CHECK (auth.uid() = traveler_id OR auth.uid() = guide_id);

-- --------------------------------------------------------------------------
-- reviews
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read accessible reviews" ON reviews;
CREATE POLICY "Users can read accessible reviews" ON reviews
  FOR SELECT USING (
    is_public = true
    OR auth.uid() = reviewer_id
    OR auth.uid() = reviewee_id
    OR EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = reviews.booking_id
        AND auth.uid() IN (b.traveler_id, b.guide_id)
    )
  );

DROP POLICY IF EXISTS "Participants can submit completed-booking reviews" ON reviews;
CREATE POLICY "Participants can submit completed-booking reviews" ON reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = reviews.booking_id
        AND b.status = 'completed'
        AND (
          (b.traveler_id = auth.uid() AND reviews.reviewee_id = b.guide_id)
          OR (b.guide_id = auth.uid() AND reviews.reviewee_id = b.traveler_id)
        )
    )
  );

-- --------------------------------------------------------------------------
-- flight_tracking
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can read booking flight tracking" ON flight_tracking;
CREATE POLICY "Participants can read booking flight tracking" ON flight_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = flight_tracking.booking_id
        AND auth.uid() IN (b.traveler_id, b.guide_id)
    )
  );

-- --------------------------------------------------------------------------
-- location_tracking
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can read booking location tracking" ON location_tracking;
CREATE POLICY "Participants can read booking location tracking" ON location_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = location_tracking.booking_id
        AND auth.uid() IN (b.traveler_id, b.guide_id)
    )
  );

DROP POLICY IF EXISTS "Guides can insert own booking location tracking" ON location_tracking;
CREATE POLICY "Guides can insert own booking location tracking" ON location_tracking
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = location_tracking.booking_id
        AND b.guide_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- invite_codes
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own invite codes" ON invite_codes;
CREATE POLICY "Users can read own invite codes" ON invite_codes
  FOR SELECT USING (auth.uid() = created_by OR auth.uid() = used_by);

DROP POLICY IF EXISTS "Guides can create invite codes" ON invite_codes;
CREATE POLICY "Guides can create invite codes" ON invite_codes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Guides can update invite codes they created" ON invite_codes;
CREATE POLICY "Guides can update invite codes they created" ON invite_codes
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- --------------------------------------------------------------------------
-- payouts
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Guides can read own payouts" ON payouts;
CREATE POLICY "Guides can read own payouts" ON payouts
  FOR SELECT USING (auth.uid() = guide_id);

DROP POLICY IF EXISTS "Guides can create own payout requests" ON payouts;
CREATE POLICY "Guides can create own payout requests" ON payouts
  FOR INSERT WITH CHECK (auth.uid() = guide_id);

-- --------------------------------------------------------------------------
-- notifications
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- sos_alerts
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can read booking sos alerts" ON sos_alerts;
CREATE POLICY "Participants can read booking sos alerts" ON sos_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = sos_alerts.booking_id
        AND auth.uid() IN (b.traveler_id, b.guide_id)
    )
  );

DROP POLICY IF EXISTS "Participants can create booking sos alerts" ON sos_alerts;
CREATE POLICY "Participants can create booking sos alerts" ON sos_alerts
  FOR INSERT WITH CHECK (
    auth.uid() = triggered_by
    AND EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = sos_alerts.booking_id
        AND auth.uid() IN (b.traveler_id, b.guide_id)
    )
  );
