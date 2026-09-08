/**
 * Traveler trip store — one cached copy of the active layover.
 *
 * Why this exists
 * ---------------
 * The layover (arrival, departure, flights, party size and type) is now the
 * single source of truth for every "does this fit?" chip and for the booking
 * screen's trip summary. Without a store, Explore, Search, Saved, the guide
 * profile, the itinerary page and the booking screen would each fire their own
 * `fetchMyTravelerProfile()` — six round-trips for one row.
 *
 * `hydrate()` is idempotent and de-duplicates concurrent callers by holding on
 * to the in-flight promise, so six screens mounting at once still produce one
 * request. `refresh()` is the explicit invalidation after any layover write —
 * without it a traveler could edit their trip on the booking screen and watch
 * Explore keep scoring cards against the old window.
 *
 * Guides have no `traveler_profiles` row, so this resolves to `null` for them
 * and every consumer hides its chip. That is a normal state, not an error.
 */

import { create } from 'zustand';
import {
  fetchMyTravelerProfile,
  type TravelerProfile,
} from '@/lib/api/travelerProfile';

type TravelerTripState = {
  profile: TravelerProfile | null;
  /** True once a fetch has completed — success OR failure. */
  hydrated: boolean;
  /** Load once. Repeat calls while a fetch is in flight share that promise. */
  hydrate: () => Promise<void>;
  /** Force a re-read. Call after any write that touches the layover. */
  refresh: () => Promise<void>;
  /** Called on sign-out so the next user never sees the previous trip. */
  reset: () => void;
};

let inFlight: Promise<void> | null = null;

async function load(set: (partial: Partial<TravelerTripState>) => void) {
  try {
    const profile = await fetchMyTravelerProfile();
    set({ profile, hydrated: true });
  } catch {
    // A guide, a signed-out user, or an offline device. All three mean "no
    // layover to score against", which the UI already handles by hiding.
    set({ profile: null, hydrated: true });
  } finally {
    inFlight = null;
  }
}

export const useTravelerTripStore = create<TravelerTripState>((set, get) => ({
  profile: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    if (inFlight) return inFlight;
    inFlight = load(set);
    return inFlight;
  },

  refresh: async () => {
    inFlight = load(set);
    return inFlight;
  },

  reset: () => {
    inFlight = null;
    set({ profile: null, hydrated: false });
  },
}));

/** Imperative refresh for call sites that aren't React components. */
export function refreshTravelerTrip(): Promise<void> {
  return useTravelerTripStore.getState().refresh();
}
