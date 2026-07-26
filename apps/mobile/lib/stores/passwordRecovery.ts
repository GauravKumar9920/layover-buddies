/**
 * Password-recovery signal store.
 *
 * When the user taps a password-reset link, the deep-link handler establishes
 * a real (recovery) Supabase session. That session would normally make the root
 * navigator bounce the user straight into the app — which is wrong: they must
 * first set a new password. This tiny store lets the deep-link handler flag
 * "a recovery is in progress" so the root navigator pins the user on the
 * reset-password screen until they finish (or cancel).
 *
 * It is deliberately separate from useAuth so a recovery session doesn't have
 * to be special-cased inside the auth bootstrap.
 */

import { create } from 'zustand';

export type PasswordRecoveryStatus = 'idle' | 'establishing' | 'ready';

type PasswordRecoveryState = {
  /**
   * establishing: a valid-looking link is being exchanged for a session.
   * ready: the session exists and the reset form may be shown.
   */
  status: PasswordRecoveryStatus;
  /** Called as soon as a recovery link starts being processed. */
  begin: () => void;
  /** Called only after setSession/exchangeCodeForSession succeeds. */
  markReady: () => void;
  /** Called after the password is updated, or when the user backs out. */
  finish: () => void;
};

export const usePasswordRecovery = create<PasswordRecoveryState>((set) => ({
  status: 'idle',
  begin: () => set({ status: 'establishing' }),
  markReady: () => set({ status: 'ready' }),
  finish: () => set({ status: 'idle' }),
}));
