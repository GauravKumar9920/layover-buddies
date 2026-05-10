-- ============================================================================
-- USER_PUSH_TOKENS — Phase 5 (push notifications)
-- ============================================================================
-- One row per device. The mobile app calls expo-notifications to obtain an
-- ExpoPushToken[xxx] string, then upserts it here. The send-push Edge fn
-- looks up valid tokens for each notification recipient and POSTs to the
-- Expo Push API. When Expo returns DeviceNotRegistered we flip is_valid=false
-- so the next cron run skips the dead token.
--
-- Multi-device per user is supported (phone + tablet, or device replacement).
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token     text        NOT NULL,
  platform            text        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id           text,                                            -- expo-device osInternalBuildId; helps de-dup re-installs
  is_valid            boolean     NOT NULL DEFAULT true,
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  invalidated_at      timestamptz,
  invalidated_reason  text,                                            -- 'DeviceNotRegistered' | 'user_logout' | 'manual'
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- One token string is unique globally — Expo guarantees this.  Used by upsert
-- on register and by the Edge fn to mark stale tokens invalid.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_push_tokens_token
  ON user_push_tokens(expo_push_token);

-- Lookup by recipient when sending pushes.  Partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_recipient
  ON user_push_tokens(user_id)
  WHERE is_valid = true;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Users manage their own tokens.  Service role bypasses for the send-push fn.

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_push_tokens_select_own ON user_push_tokens;
CREATE POLICY user_push_tokens_select_own ON user_push_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_tokens_insert_own ON user_push_tokens;
CREATE POLICY user_push_tokens_insert_own ON user_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_tokens_update_own ON user_push_tokens;
CREATE POLICY user_push_tokens_update_own ON user_push_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_tokens_delete_own ON user_push_tokens;
CREATE POLICY user_push_tokens_delete_own ON user_push_tokens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON user_push_tokens TO authenticated;
GRANT ALL ON user_push_tokens TO service_role;
