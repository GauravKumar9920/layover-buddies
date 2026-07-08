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

type PasswordRecoveryState = {
  /** True from the moment a recovery link is opened until the password is set/cancelled. */
  recovering: boolean;
  /** Called by the deep-link handler once a recovery session is established. */
  begin: () => void;
  /** Called after the password is updated, or when the user backs out. */
  finish: () => void;
};

export const usePasswordRecovery = create<PasswordRecoveryState>((set) => ({
  recovering: false,
  begin: () => set({ recovering: true }),
  finish: () => set({ recovering: false }),
}));
