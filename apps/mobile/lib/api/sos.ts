// ============================================================================
// SOS API — real emergency alerts (APP_REVIEW §2 "nothing creates an SOS")
// ============================================================================
// Inserts a row into `sos_alerts`, which the admin console's SOS page polls
// and resolves. RLS: the booking's traveler or guide may insert, and
// `triggered_by` must equal auth.uid() — enforced by the
// "Participants can create booking sos alerts" policy.
//
// `latitude`/`longitude` are NOT NULL in the schema, so callers must always
// pass coordinates — the UI falls back to the guide's last shared location
// or central Mumbai when the device's own fix is unavailable. An SOS with an
// approximate location still beats no SOS at all.
// ============================================================================

import { supabase } from '../supabase';
import type { Database } from '@/types/supabase';

export type SosAlert = Database['public']['Tables']['sos_alerts']['Row'];

export interface TriggerSosInput {
  bookingId: string;
  latitude: number;
  longitude: number;
}

/**
 * Fire an SOS for a booking. Returns the created alert row.
 * Throws if the user is not authenticated or the insert is rejected.
 */
export async function triggerSos(input: TriggerSosInput): Promise<SosAlert> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('sos_alerts')
    .insert({
      booking_id: input.bookingId,
      triggered_by: user.id,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * The most recent open (not resolved) alert this user fired for a booking.
 * Used to prevent accidental duplicate SOS spam from repeated taps.
 */
export async function fetchMyOpenSos(bookingId: string): Promise<SosAlert | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('sos_alerts')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('triggered_by', user.id)
    .neq('status', 'resolved')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
