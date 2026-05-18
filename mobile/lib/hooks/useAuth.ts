import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { getUserRole } from '../auth';
import { registerPushTokenIfPossible } from '../push/registerPushToken';
import { subscribeOnboardingComplete } from '../onboardingSignal';
import type { UserRole } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  /**
   * True when the signed-in user is a traveler who hasn't yet completed the
   * post-signup onboarding flow (nationality, layover, interests). The root
   * layout uses this to force-route them to /(traveler)/onboarding so they
   * can never reach Explore without filling out the basics first.
   *
   * Always false for guides and signed-out users.
   */
  needsOnboarding: boolean;
  /**
   * Set when bootstrap-time session restoration fails with a recoverable error
   * (stale refresh token, backend unreachable, etc). The login screen reads
   * this and surfaces it as a banner so users know why they're back at login.
   * Cleared automatically on the next successful auth state change.
   */
  bootstrapError: string | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    loading: true,
    needsOnboarding: false,
    bootstrapError: null,
  });

  useEffect(() => {
    let isMounted = true;
    let bootstrapResolved = false;

    const safeSetState = (next: AuthState) => {
      if (isMounted) {
        setState(next);
      }
    };

    const clearToSignedOut = (bootstrapError: string | null = null) => {
      safeSetState({
        session: null,
        user: null,
        role: null,
        loading: false,
        needsOnboarding: false,
        bootstrapError,
      });
    };

    // ---- Onboarding probe ----------------------------------------------------
    // For travelers we check whether `traveler_profiles.onboarded_at` is set.
    // Returns false on errors or for non-traveler roles — never blocks routing.
    //
    // PostgREST returns errors via the `{ data, error }` tuple rather than
    // throwing, so a permission / network / schema failure would leave
    // `data === null` and naively return `true` (forcing onboarding). Treat
    // any explicit `error`, plus the existing throw path, as "don't block".
    const probeOnboarding = async (userId: string, role: UserRole | null): Promise<boolean> => {
      if (role !== 'traveler') return false;
      try {
        const { data, error } = await supabase
          .from('traveler_profiles')
          .select('onboarded_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) {
          // Surface in dev but don't gate routing on transient failures.
          // eslint-disable-next-line no-console
          console.warn('[useAuth] probeOnboarding error, allowing through:', error.message);
          return false;
        }
        return !data?.onboarded_at;
      } catch {
        return false;
      }
    };

    // Prevent a stuck blank bootstrap screen if the local backend is unreachable.
    // If this fires before bootstrapSession resolves, surface a clear message —
    // otherwise the user just sees an indefinite spinner with no clue why.
    const bootstrapTimeout = setTimeout(() => {
      if (bootstrapResolved) return;
      clearToSignedOut('Backend unreachable. Make sure local Supabase is running.');
    }, 10000);

    const bootstrapSession = async () => {
      // Grab the current session; after local DB resets, refresh tokens may be invalid.
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        const message = (error.message ?? '').toLowerCase();
        if (message.includes('refresh token')) {
          // signOut({scope: 'local'}) wipes the stale tokens from localStorage,
          // so the next page load doesn't re-trigger the same loop.
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {
            // Ignore secondary cleanup errors; state still falls back to signed out.
          });
          clearToSignedOut('Your session expired. Please sign in again.');
          return;
        }
        clearToSignedOut(error.message || 'Could not restore your session.');
        return;
      }

      if (session?.user) {
        const role = await getUserRole(session.user.id);
        const needsOnboarding = await probeOnboarding(session.user.id, role);
        safeSetState({
          session,
          user: session.user,
          role,
          loading: false,
          needsOnboarding,
          bootstrapError: null,
        });
        // Best-effort: register an Expo Push token so balance reminders,
        // late-fee alerts, and top-up requests can reach this device.
        // Never throws; safe to fire-and-forget.
        void registerPushTokenIfPossible(session.user.id);
      } else {
        clearToSignedOut();
      }
    };

    void bootstrapSession().finally(() => {
      bootstrapResolved = true;
      clearTimeout(bootstrapTimeout);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const role = await getUserRole(session.user.id);
          const needsOnboarding = await probeOnboarding(session.user.id, role);
          safeSetState({
            session,
            user: session.user,
            role,
            loading: false,
            needsOnboarding,
            bootstrapError: null,
          });
          void registerPushTokenIfPossible(session.user.id);
        } else {
          clearToSignedOut();
        }
      },
    );

    // Re-probe onboarding the moment the onboarding screen finishes writing
    // `onboarded_at`. We flip needsOnboarding=false synchronously so the
    // root layout's router guard sees the new value on the very next render
    // — otherwise it bounces the user back to /(traveler)/onboarding before
    // the async DB probe returns.
    const unsubscribeOnboardingSignal = subscribeOnboardingComplete(() => {
      setState((prev) => ({ ...prev, needsOnboarding: false }));
    });

    return () => {
      isMounted = false;
      clearTimeout(bootstrapTimeout);
      subscription.unsubscribe();
      unsubscribeOnboardingSignal();
    };
  }, []);

  return state;
}
