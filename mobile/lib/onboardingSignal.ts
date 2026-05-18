// ============================================================================
// ONBOARDING-COMPLETE SIGNAL
// ============================================================================
// Tiny pub-sub used to tell `useAuth` to re-probe `traveler_profiles.onboarded_at`
// after the onboarding screen has just written it. Without this the auth hook
// sticks with `needsOnboarding=true` from boot — and the root-layout router
// snaps the user right back to /(traveler)/onboarding the moment the
// onboarding screen tries to replace itself with /(tabs).
//
// Decoupled from useAuth so the screen doesn't need to import the hook just
// to trigger a refresh.
// ============================================================================

type Listener = () => void;
let listeners: Listener[] = [];

/** Called by the onboarding screen after completeOnboarding() succeeds. */
export function notifyOnboardingComplete(): void {
  for (const fn of listeners) {
    try { fn(); } catch { /* listeners must self-isolate */ }
  }
}

/** Subscribe to onboarding-complete notifications. Returns an unsubscribe fn. */
export function subscribeOnboardingComplete(fn: Listener): () => void {
  listeners = [...listeners, fn];
  return () => { listeners = listeners.filter((l) => l !== fn); };
}
