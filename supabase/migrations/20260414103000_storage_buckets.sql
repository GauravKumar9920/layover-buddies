-- Storage bucket for itinerary cover photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('itinerary-photos', 'itinerary-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated guides can upload to itinerary-photos
CREATE POLICY "Guides can upload itinerary photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'itinerary-photos' AND auth.uid() IS NOT NULL);

-- Guides can update/replace their own photos
CREATE POLICY "Guides can update itinerary photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'itinerary-photos' AND auth.uid() IS NOT NULL);

-- Guides can delete their own photos
CREATE POLICY "Guides can delete itinerary photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'itinerary-photos' AND auth.uid() IS NOT NULL);

-- Public read for all itinerary photos
CREATE POLICY "Anyone can view itinerary photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'itinerary-photos');

-- Avatars bucket (needed for guide profile photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
