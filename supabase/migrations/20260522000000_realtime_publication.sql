-- ============================================================================
-- Add lifecycle tables to the supabase_realtime publication
-- ============================================================================
-- The mobile + admin apps subscribe to Realtime channels on these tables so
-- screens auto-advance when the server flips status (e.g. trip_ready →
-- in_progress after a QR scan). Without the table in the publication, the
-- Postgres logical-replication slot doesn't emit row events for the table,
-- so client subscriptions stay quiet and the UI looks frozen even though
-- the DB is in the new state.
--
-- `notifications` and `top_up_requests` were already published by earlier
-- migrations; we add the remaining tables every screen subscribes to.
-- ============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'bookings',
    'agreements',
    'deposits',
    'messages',
    'expense_proofs',
    'location_tracking',
    'payout_dispatches'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_publication_tables
       WHERE pubname    = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename  = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
