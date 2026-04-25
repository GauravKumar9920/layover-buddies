/**
 * Favorites store — the heart button on the Hinge-style detail page.
 *
 * Architecture
 * ------------
 * We keep a local Zustand store as the source of truth for the UI (so the
 * heart flips instantly on tap) and lazily sync to Supabase. On app boot
 * (or when the user id changes) we `hydrate()` from the `favorites` table.
 *
 * The `toggle()` helper does an optimistic flip: it updates the local set,
 * fires the remote mutation, and rolls back on error. This is the pattern
 * we want for any "tap-to-toggle" UX — it keeps the interaction at 60fps
 * even on flaky networks.
 *
 * If Supabase isn't configured (local dev without env vars) the store
 * degrades gracefully to an in-memory set that still behaves correctly
 * across navigation inside one session.
 */

import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../supabase';

type FavoritesState = {
  /** Itinerary ids the current user has favorited. */
  ids: Set<string>;
  /** True once we've fetched the initial server state for `currentUserId`. */
  hydrated: boolean;
  /** User whose favorites are currently loaded (used to invalidate on switch). */
  currentUserId: string | null;

  /** Load favorites for a user. No-op if already hydrated for the same user. */
  hydrate: (userId: string | null) => Promise<void>;
  /** Add/remove an itinerary from the user's favorites. Optimistic. */
  toggle: (itineraryId: string, userId: string | null) => Promise<boolean>;
  /** Synchronous read — the one the UI uses during render. */
  isFavorited: (itineraryId: string) => boolean;
  /** Called on sign-out. */
  reset: () => void;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set<string>(),
  hydrated: false,
  currentUserId: null,

  hydrate: async (userId) => {
    const state = get();

    // No user — clear and exit.
    if (!userId) {
      set({ ids: new Set(), hydrated: true, currentUserId: null });
      return;
    }

    // Already hydrated for this user — skip the round-trip.
    if (state.hydrated && state.currentUserId === userId) return;

    // Local-only fallback: still mark as hydrated so the UI doesn't spin.
    if (!isSupabaseConfigured) {
      set({ ids: new Set(), hydrated: true, currentUserId: userId });
      return;
    }

    const { data, error } = await supabase
      .from('favorites')
      .select('itinerary_id')
      .eq('user_id', userId);

    if (error) {
      // Fail open — hydrate empty so the heart still works in-session.
      console.warn('[favorites] hydrate failed:', error.message);
      set({ ids: new Set(), hydrated: true, currentUserId: userId });
      return;
    }

    const next = new Set<string>((data ?? []).map((row) => row.itinerary_id as string));
    set({ ids: next, hydrated: true, currentUserId: userId });
  },

  toggle: async (itineraryId, userId) => {
    const { ids } = get();
    const wasFavorited = ids.has(itineraryId);

    // Optimistic flip.
    const next = new Set(ids);
    if (wasFavorited) next.delete(itineraryId);
    else next.add(itineraryId);
    set({ ids: next });

    // No remote to sync to — leave the optimistic state in place.
    if (!userId || !isSupabaseConfigured) {
      return !wasFavorited;
    }

    try {
      if (wasFavorited) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('itinerary_id', itineraryId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .upsert(
            { user_id: userId, itinerary_id: itineraryId },
            { onConflict: 'user_id,itinerary_id' },
          );
        if (error) throw error;
      }
      return !wasFavorited;
    } catch (err) {
      // Roll back on failure.
      console.warn('[favorites] toggle failed, reverting:', err);
      const rollback = new Set(get().ids);
      if (wasFavorited) rollback.add(itineraryId);
      else rollback.delete(itineraryId);
      set({ ids: rollback });
      return wasFavorited;
    }
  },

  isFavorited: (itineraryId) => get().ids.has(itineraryId),

  reset: () => set({ ids: new Set(), hydrated: false, currentUserId: null }),
}));

/**
 * Convenience hook for screens that just need to know "is this favorited?".
 * Subscribes granularly so unrelated toggles don't re-render the screen.
 */
export function useIsFavorited(itineraryId: string): boolean {
  return useFavoritesStore((s) => s.ids.has(itineraryId));
}
