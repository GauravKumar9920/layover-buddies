-- ============================================================================
-- STORAGE OBJECT OWNERSHIP
-- ============================================================================
-- The original policies checked only "authenticated", so any signed-in user
-- could overwrite or delete another guide's public media. Every app upload path
-- is user-namespaced; enforce that namespace for INSERT/UPDATE/DELETE.
-- ============================================================================

DROP POLICY IF EXISTS "Guides can upload itinerary photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can update itinerary photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can delete itinerary photos" ON storage.objects;

CREATE POLICY "Users upload own itinerary photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'itinerary-photos'
    AND public.account_is_active(auth.uid())
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] IN ('gallery', 'stops')
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

CREATE POLICY "Users update own itinerary photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'itinerary-photos'
    AND public.account_is_active(auth.uid())
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] IN ('gallery', 'stops')
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
  WITH CHECK (
    bucket_id = 'itinerary-photos'
    AND public.account_is_active(auth.uid())
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] IN ('gallery', 'stops')
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

CREATE POLICY "Users delete own itinerary photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'itinerary-photos'
    AND public.account_is_active(auth.uid())
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] IN ('gallery', 'stops')
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatars" ON storage.objects;

CREATE POLICY "Users upload own avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.account_is_active(auth.uid())
    AND (storage.foldername(name))[1] = 'avatars'
    AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
  );

CREATE POLICY "Users update own avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.account_is_active(auth.uid())
    AND (storage.foldername(name))[1] = 'avatars'
    AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.account_is_active(auth.uid())
    AND (storage.foldername(name))[1] = 'avatars'
    AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
  );

CREATE POLICY "Users delete own avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.account_is_active(auth.uid())
    AND (storage.foldername(name))[1] = 'avatars'
    AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
  );
