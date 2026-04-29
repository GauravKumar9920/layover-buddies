import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { getUserRole } from '../auth';
import type { UserRole } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  loading: boolean;
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
        bootstrapError,
      });
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
        safeSetState({
          session,
          user: session.user,
          role,
          loading: false,
          bootstrapError: null,
        });
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
          safeSetState({
            session,
            user: session.user,
            role,
            loading: false,
            bootstrapError: null,
          });
        } else {
          clearToSignedOut();
        }
      },
    );

    return () => {
      isMounted = false;
      clearTimeout(bootstrapTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
