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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type PasswordRecoveryStatus = 'idle' | 'establishing' | 'ready';

const STORAGE_KEY = 'detour:password-recovery';
const RECOVERY_MARKER_TTL_MS = 60 * 60 * 1000;

type PasswordRecoveryState = {
  /**
   * establishing: a valid-looking link is being exchanged for a session.
   * ready: the session exists and the reset form may be shown.
   */
  status: PasswordRecoveryStatus;
  /** True once the persisted recovery marker has been checked. */
  hydrated: boolean;
  /** Restores a recent recovery marker after an app restart. */
  hydrate: () => Promise<void>;
  /** Called as soon as a recovery link starts being processed. */
  begin: () => Promise<void>;
  /** Called only after setSession/exchangeCodeForSession succeeds. */
  markReady: () => Promise<void>;
  /** Called after the password is updated, or when the user backs out. */
  finish: () => Promise<void>;
};

export const usePasswordRecovery = create<PasswordRecoveryState>((set) => ({
  status: 'idle',
  hydrated: false,
  hydrate: async () => {
    let restoredStatus: PasswordRecoveryStatus = 'idle';

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const marker = JSON.parse(stored) as { readyAt?: unknown };
        const readyAt = typeof marker.readyAt === 'number' ? marker.readyAt : 0;
        if (readyAt > 0 && Date.now() - readyAt <= RECOVERY_MARKER_TTL_MS) {
          restoredStatus = 'ready';
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // A corrupt/unavailable marker must never trap the user in recovery.
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }

    set((state) => ({
      // A deep link may have started exchanging while AsyncStorage was read.
      // Never let stale hydration overwrite that live transition.
      status: state.status === 'idle' ? restoredStatus : state.status,
      hydrated: true,
    }));
  },
  begin: async () => {
    set({ status: 'establishing' });
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
  markReady: async () => {
    // Persist before routing so a process kill cannot lose the recovery intent
    // after Supabase has already persisted the recovery session.
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ readyAt: Date.now() }),
    ).catch(() => {});
    set({ status: 'ready' });
  },
  finish: async () => {
    // Clear in-memory state immediately so navigation can proceed, then remove
    // the durable marker before the caller completes its cleanup.
    set({ status: 'idle' });
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));
