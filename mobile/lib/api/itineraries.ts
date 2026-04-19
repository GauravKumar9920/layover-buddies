import { supabase } from '../supabase';
import type { Itinerary, ItineraryStop } from '@/types';

interface RawItineraryRow {
  id: string;
  guide_id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
  duration_hours: number | null;
  buddy_cost: number | null;
  is_published: boolean | null;
  created_at: string;
}

function normalizeItinerary(
  row: RawItineraryRow,
  stops: Omit<ItineraryStop, 'id' | 'itinerary_id'>[],
): Itinerary {
  return {
    id: row.id,
    guide_id: row.guide_id,
    name: row.title ?? 'Mumbai Tour',
    title: row.title ?? 'Mumbai Tour',
    description: row.description ?? '',
    city: 'Mumbai',
    category: row.category,
    image_url: row.cover_image_url ?? null,
    cover_image_url: row.cover_image_url ?? null,
    estimated_duration_hours: Number(row.duration_hours ?? 0),
    buddy_cost_inr: Number(row.buddy_cost ?? 0),
    max_travelers: 1,
    is_active: row.is_published ?? false,
    created_at: row.created_at,
    stops: stops.map((stop, index) => ({
      id: `local-stop-${index + 1}`,
      itinerary_id: row.id,
      order: stop.order ?? index + 1,
      location: stop.location,
      description: stop.description,
      estimated_duration_minutes: stop.estimated_duration_minutes,
      image_url: stop.image_url ?? null,
    })),
  };
}

export interface CreateItineraryRequest {
  name: string;
  description: string;
  estimated_duration_hours: number;
  buddy_cost_inr: number;
  category?: string;
  cover_image_url?: string | null;
  stops: Omit<ItineraryStop, 'id' | 'itinerary_id'>[];
}

export async function createItinerary(req: CreateItineraryRequest): Promise<Itinerary> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { stops, name, estimated_duration_hours, buddy_cost_inr, category, cover_image_url, ...rest } = req;

  // itineraries.guide_id references users(id), so use the auth user's ID directly
  const { data: itin, error } = await supabase
    .from('itineraries')
    .insert({
      ...rest,
      title: name,
      duration_hours: estimated_duration_hours,
      buddy_cost: buddy_cost_inr,
      guide_id: user.id,
      is_published: true,
      category: category ?? 'custom',
      cover_image_url: cover_image_url ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;

  if (stops.length > 0) {
    const { error: stopError } = await supabase.from('itinerary_stops').insert(
      stops.map((s, i) => ({
        itinerary_id: itin.id,
        stop_order: s.order ?? i + 1,
        name: s.location,
        description: s.description,
        estimated_duration_minutes: s.estimated_duration_minutes,
      })),
    );

    if (stopError) {
      // Compensating delete keeps data consistent when stop inserts fail.
      await supabase.from('itineraries').delete().eq('id', itin.id);
      throw stopError;
    }
  }

  return normalizeItinerary(itin as RawItineraryRow, stops);
}

export async function updateItinerary(
  itinId: string,
  updates: Partial<Omit<Itinerary, 'id' | 'guide_id' | 'created_at'>>,
): Promise<void> {
  const { name, estimated_duration_hours, buddy_cost_inr, is_active, city: _city, max_travelers: _max, ...rest } = updates as Record<string, unknown> & typeof updates;
  const schemaUpdates: Record<string, unknown> = { ...rest };
  if (name !== undefined) schemaUpdates.title = name;
  if (estimated_duration_hours !== undefined) schemaUpdates.duration_hours = estimated_duration_hours;
  if (buddy_cost_inr !== undefined) schemaUpdates.buddy_cost = buddy_cost_inr;
  if (is_active !== undefined) schemaUpdates.is_published = is_active;

  const { error } = await supabase
    .from('itineraries')
    .update(schemaUpdates)
    .eq('id', itinId);

  if (error) throw error;
}

export async function deleteItinerary(itinId: string): Promise<void> {
  const { error } = await supabase
    .from('itineraries')
    .update({ is_published: false })
    .eq('id', itinId);

  if (error) throw error;
}
