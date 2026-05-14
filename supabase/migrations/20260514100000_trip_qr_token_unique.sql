-- ============================================================================
-- Phase 4 hardening — UNIQUE constraint on bookings.trip_qr_token
-- ============================================================================
-- Background:
--   trip_qr_token is the sole secret that authorises a buddy's QR scan to
--   start a trip (qr-scan Edge Function). Before this migration it only had
--   a partial btree index `idx_bookings_qr_token WHERE trip_qr_token IS NOT NULL`
--   — fast for lookups but with no uniqueness guarantee. A bug that generated
--   a constant or short token (or a future caller that reuses tokens) could
--   let a single scan match multiple bookings.
--
-- Fix:
--   Replace the plain partial index with a UNIQUE partial index. NULL tokens
--   are allowed (most bookings have no QR yet); non-NULL tokens must be unique
--   across the whole bookings table.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_bookings_qr_token;

CREATE UNIQUE INDEX idx_bookings_qr_token
  ON public.bookings (trip_qr_token)
  WHERE trip_qr_token IS NOT NULL;

COMMENT ON INDEX public.idx_bookings_qr_token IS
  'Partial UNIQUE: enforces that every non-NULL trip_qr_token is globally unique.'
  ' Replaces the prior non-unique partial index (review 2026-05-14 finding #11).';
