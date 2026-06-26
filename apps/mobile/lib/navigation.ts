// ─── Safe-back navigation helper ─────────────────────────────────────────────
//
// `router.back()` from expo-router is a no-op when the navigation stack has
// no entry to go back to. That happens whenever the user lands on a screen
// via `router.replace()`, a direct URL, a refresh, or as the first screen
// after sign-in. Symptom: tapping the ‹ arrow in any header does nothing.
//
// `safeBack` wraps that: it calls `router.back()` when there *is* history,
// otherwise it replaces the current screen with a sensible fallback so the
// arrow is never a dead end. Callers pass the fallback they consider the
// "parent" of their screen.
//
// Usage:
//
//   const router = useRouter();
//   safeBack(router, '/(traveler)/');
//
// or via the hook:
//
//   const back = useSafeBack('/(traveler)/');
//   <TouchableOpacity onPress={back}>‹</TouchableOpacity>

import { useCallback } from 'react';
import { useRouter, type Router } from 'expo-router';

export function safeBack(router: Router, fallback: string = '/'): void {
  // expo-router exposes canGoBack on the Router object. When the stack has
  // history, this returns true and we just pop.
  if (typeof router.canGoBack === 'function' && router.canGoBack()) {
    router.back();
    return;
  }
  // No history — replace with the fallback. We use replace (not push) so the
  // user can't end up with a redundant "back" entry pointing at this screen.
  router.replace(fallback as never);
}

export function useSafeBack(fallback: string = '/'): () => void {
  const router = useRouter();
  return useCallback(() => safeBack(router, fallback), [router, fallback]);
}
