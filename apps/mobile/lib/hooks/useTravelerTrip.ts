/**
 * Read the signed-in traveler's active layover, hydrating it once.
 *
 * Everything a "does this trip fit?" chip needs, in the shape the callers
 * actually want: hours as a number, interests for the match badge, and the
 * party. Screens should reach for this rather than calling
 * `fetchMyTravelerProfile()` directly — see lib/stores/travelerTrip.ts.
 */

import { useEffect } from 'react';
import { useTravelerTripStore } from '@/lib/stores/travelerTrip';
import { layoverHoursBetween } from '@/lib/booking/timeFit';
import type { PartyType, TravelerProfile } from '@/lib/api/travelerProfile';

export interface TravelerTrip {
  profile: TravelerProfile | null;
  /** Layover length in hours, or null when there is no usable window. */
  layoverHours: number | null;
  interests: string[] | null;
  groupSize: number;
  partyType: PartyType | null;
  hasActiveLayover: boolean;
  /** False until the first fetch settles — use it to avoid a chip flash. */
  hydrated: boolean;
  refresh: () => Promise<void>;
}

export function useTravelerTrip(): TravelerTrip {
  const profile = useTravelerTripStore((s) => s.profile);
  const hydrated = useTravelerTripStore((s) => s.hydrated);
  const hydrate = useTravelerTripStore((s) => s.hydrate);
  const refresh = useTravelerTripStore((s) => s.refresh);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return {
    profile,
    layoverHours: layoverHoursBetween(profile?.arrival_at, profile?.departure_at),
    interests: profile?.interests ?? null,
    groupSize: profile?.group_size ?? 1,
    partyType: profile?.party_type ?? null,
    hasActiveLayover: Boolean(profile?.active_layover_id),
    hydrated,
    refresh,
  };
}

/** Just the number, for cards that only score a fit. */
export function useLayoverHours(): number | null {
  return useTravelerTrip().layoverHours;
}
