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
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const safeSetState = (next: AuthState) => {
      if (isMounted) {
        setState(next);
      }
    };

    const clearToSignedOut = () => {
      safeSetState({ session: null, user: null, role: null, loading: false });
    };

    // Prevent a stuck blank bootstrap screen if local backend is unreachable.
    const bootstrapTimeout = setTimeout(() => {
      clearToSignedOut();
    }, 10000);

    const bootstrapSession = async () => {
      // Grab the current session; after local DB resets, refresh tokens may be invalid.
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        const message = (error.message ?? '').toLowerCase();
        if (message.includes('refresh token')) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {
            // Ignore secondary cleanup errors; state still falls back to signed out.
          });
        }
        clearToSignedOut();
        return;
      }

      if (session?.user) {
        const role = await getUserRole(session.user.id);
        safeSetState({ session, user: session.user, role, loading: false });
      } else {
        clearToSignedOut();
      }
    };

    void bootstrapSession().finally(() => {
      clearTimeout(bootstrapTimeout);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const role = await getUserRole(session.user.id);
          safeSetState({ session, user: session.user, role, loading: false });
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
