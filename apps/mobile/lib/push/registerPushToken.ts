// ============================================================================
// PUSH TOKEN REGISTRATION — Phase 5
// ============================================================================
// Lightweight wrapper around expo-notifications + expo-device that:
//   1. Skips simulators (no real push tokens issued)
//   2. Asks for permission if not already granted
//   3. Fetches the ExpoPushToken[…] string via the EAS project ID
//   4. Upserts a row into user_push_tokens (RLS allows user_id = auth.uid())
//
// Called from useAuth's bootstrap and onAuthStateChange handlers after the
// session + role have been resolved.  Never throws — push registration is
// best-effort; the rest of the app must keep working if Expo's servers are
// down or the user denies permission.
// ============================================================================

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../supabase';

const TOKEN_LOG_PREFIX = '[push]';

interface ExpoConfigExtra {
  eas?: { projectId?: string };
}

function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as ExpoConfigExtra | undefined;
  return extra?.eas?.projectId
      ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
      ?? undefined;
}

function platformValue(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * Try to register the current device's Expo push token for the given user.
 * Idempotent — safe to call repeatedly across sessions.
 *
 * Returns the token on success; `null` if registration was skipped (simulator,
 * permission denied, or any non-fatal error).
 */
export async function registerPushTokenIfPossible(userId: string): Promise<string | null> {
  // 1. Simulators don't get real push tokens. Bail silently.
  if (!Device.isDevice) {
    if (__DEV__) console.log(`${TOKEN_LOG_PREFIX} skipping — simulator/emulator`);
    return null;
  }

  try {
    // 2. Permission. Defer the prompt until we're confident the user is
    //    actually using the app (i.e., post-login).
    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      if (__DEV__) console.log(`${TOKEN_LOG_PREFIX} permission denied`);
      return null;
    }

    // 3. Get the ExpoPushToken. EAS project ID is required when running in a
    //    bare workflow (or when expo-notifications can't infer it).
    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) return null;

    // 4. Upsert into user_push_tokens. The unique constraint on
    //    expo_push_token ensures we replace stale rows for the same device.
    const { error } = await supabase.from('user_push_tokens').upsert(
      {
        user_id:           userId,
        expo_push_token:   token,
        platform:          platformValue(),
        device_id:         Device.osInternalBuildId ?? null,
        is_valid:          true,
        last_seen_at:      new Date().toISOString(),
        invalidated_at:    null,
        invalidated_reason: null,
      },
      { onConflict: 'expo_push_token' },
    );

    if (error) {
      if (__DEV__) console.warn(`${TOKEN_LOG_PREFIX} upsert failed: ${error.message}`);
      return null;
    }

    return token;
  } catch (err) {
    if (__DEV__) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`${TOKEN_LOG_PREFIX} registration failed: ${msg}`);
    }
    return null;
  }
}

/**
 * Best-effort: mark this device's push token invalid in the DB before the
 * user signs out, so we don't keep blasting pushes to a logged-out device.
 *
 * Runs only on real devices; safely no-ops on simulators or when Expo
 * is unreachable.
 */
export async function invalidateOwnPushTokenOnLogout(): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) return;

    await supabase
      .from('user_push_tokens')
      .update({
        is_valid:          false,
        invalidated_at:    new Date().toISOString(),
        invalidated_reason:'user_logout',
      })
      .eq('expo_push_token', token);
  } catch (err) {
    if (__DEV__) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`${TOKEN_LOG_PREFIX} logout invalidation failed: ${msg}`);
    }
  }
}
