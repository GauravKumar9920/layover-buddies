// ============================================================================
// PASSWORD-RECOVERY DEEP LINK HANDLER
// ============================================================================
// `detectSessionInUrl` is false on native (it's a web-only Supabase feature),
// so we parse the emailed reset link ourselves and establish the recovery
// session manually. Supports both Supabase auth flows:
//   • implicit — tokens arrive in the URL fragment
//       detour://reset-password#access_token=…&refresh_token=…&type=recovery
//   • PKCE     — a single-use code arrives in the query string
//       detour://reset-password?code=…
// Once a session is established we flag `usePasswordRecovery` and route to the
// set-new-password screen. The root navigator keeps the user there until done.
// ============================================================================

import * as Linking from 'expo-linking';
import type { Router } from 'expo-router';
import { supabase } from '../supabase';
import { usePasswordRecovery } from '../stores/passwordRecovery';
import { notify } from '../ui/alert';
import { paramsFromUrl, isRecoveryLink, credentialsFromParams } from './recoveryUrl';

async function handleUrl(url: string | null, router: Router): Promise<void> {
  if (!url) return;
  const params = paramsFromUrl(url);
  if (!isRecoveryLink(url, params)) return;

  const { accessToken, refreshToken, code, errorDescription } = credentialsFromParams(params);

  // Enter an establishing phase BEFORE touching the session. The root router
  // pauses role-based redirects during this phase, but does not show the reset
  // form until the session exchange has actually succeeded.
  await usePasswordRecovery.getState().begin();

  try {
    if (errorDescription) {
      throw new Error(errorDescription.replace(/\+/g, ' '));
    }
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      // A recovery-looking link with no credentials at all — treat as expired.
      throw new Error('This reset link is missing its security token.');
    }
    await usePasswordRecovery.getState().markReady();
    router.replace('/(auth)/reset-password');
  } catch (err) {
    await usePasswordRecovery.getState().finish().catch(() => {});
    notify(
      'Reset link expired',
      `${err instanceof Error ? err.message : 'This reset link is no longer valid.'}\n\nRequest a new password reset link to continue.`,
    );
    router.replace('/(auth)/forgot-password');
  }
}

/**
 * Wire up password-recovery deep-link handling. Handles both the warm case
 * (app already open, `url` event) and the cold case (app launched by the link,
 * `getInitialURL`). Returns a subscription-like object so the caller can
 * unsubscribe on unmount.
 */
export function setupPasswordRecoveryLink(router: Router): { remove: () => void } {
  const sub = Linking.addEventListener('url', ({ url }) => {
    void handleUrl(url, router);
  });
  void Linking.getInitialURL().then((url) => handleUrl(url, router));
  return { remove: () => sub.remove() };
}
