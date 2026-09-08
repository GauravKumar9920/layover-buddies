import { supabase } from '../supabase';
import type { EditableStop } from '@/components/guides/StopEditor';
import type { Itinerary, ItineraryStop } from '@/types';

interface RawItineraryRow {
  id: string;
  guide_id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
  duration_hours: number | null;
  base_cost: number | null;
  buddy_cost: number | null;
  max_travelers: number | null;
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
    base_cost_inr: Number(row.base_cost ?? 0),
    buddy_cost_inr: Number(row.buddy_cost ?? 0),
    max_travelers: Number(row.max_travelers ?? 1),
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
  /** Flat charge, once per booking. */
  base_cost_inr: number;
  /** Per-person charge. Party of N pays base_cost_inr + buddy_cost_inr * N. */
  buddy_cost_inr: number;
  max_travelers: number;
  category?: string;
  cover_image_url?: string | null;
  stops: Omit<ItineraryStop, 'id' | 'itinerary_id'>[];
}

export async function createItinerary(req: CreateItineraryRequest): Promise<Itinerary> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { stops, name, estimated_duration_hours, base_cost_inr, buddy_cost_inr, max_travelers, category, cover_image_url, ...rest } = req;

  // itineraries.guide_id references users(id), so use the auth user's ID directly
  const { data: itin, error } = await supabase
    .from('itineraries')
    .insert({
      ...rest,
      title: name,
      duration_hours: estimated_duration_hours,
      base_cost: base_cost_inr,
      buddy_cost: buddy_cost_inr,
      max_travelers,
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
        image_url: s.image_url ?? null,
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
  stopsChange?: { current: EditableStop[]; original: EditableStop[] },
): Promise<void> {
  const { name, estimated_duration_hours, base_cost_inr, buddy_cost_inr, is_active, max_travelers, city: _city, ...rest } = updates as Record<string, unknown> & typeof updates;
  const schemaUpdates: Record<string, unknown> = { ...rest };
  if (name !== undefined) schemaUpdates.title = name;
  if (estimated_duration_hours !== undefined) schemaUpdates.duration_hours = estimated_duration_hours;
  if (base_cost_inr !== undefined) schemaUpdates.base_cost = base_cost_inr;
  if (buddy_cost_inr !== undefined) schemaUpdates.buddy_cost = buddy_cost_inr;
  if (max_travelers !== undefined) schemaUpdates.max_travelers = max_travelers;
  if (is_active !== undefined) schemaUpdates.is_published = is_active;

  if (Object.keys(schemaUpdates).length > 0) {
    const { error } = await supabase
      .from('itineraries')
      .update(schemaUpdates)
      .eq('id', itinId);

    if (error) throw error;
  }

  if (stopsChange) {
    await applyStopChanges(itinId, stopsChange.current, stopsChange.original);
  }
}

/**
 * Diffs the current stop list against the originally-loaded one and applies the
 * minimum set of inserts/updates/deletes. Order matters here: we delete removed
 * rows first so re-numbering of stop_order can't collide with a UNIQUE-style
 * future constraint, then insert/update the rest.
 *
 * Stops with no `id` are treated as new inserts. Existing stops are matched by
 * id and updated only if any of their editable fields changed.
 */
async function applyStopChanges(
  itinId: string,
  current: EditableStop[],
  original: EditableStop[],
): Promise<void> {
  const filtered = current.filter((s) => s.location.trim());
  const currentIds = new Set(filtered.map((s) => s.id).filter((id): id is string => !!id));
  const removed = original.filter((s) => s.id && !currentIds.has(s.id));

  if (removed.length > 0) {
    const ids = removed.map((s) => s.id!) as string[];
    const { error } = await supabase
      .from('itinerary_stops')
      .delete()
      .in('id', ids);
    if (error) throw error;
  }

  const inserts = filtered
    .map((s, i) => ({ s, order: i + 1 }))
    .filter(({ s }) => !s.id)
    .map(({ s, order }) => ({
      itinerary_id: itinId,
      stop_order: order,
      name: s.location,
      description: s.description,
      estimated_duration_minutes: s.estimated_duration_minutes,
      image_url: s.image_url ?? null,
    }));

  if (inserts.length > 0) {
    const { error } = await supabase.from('itinerary_stops').insert(inserts);
    if (error) throw error;
  }

  const originalById = new Map(original.filter((s) => s.id).map((s) => [s.id!, s]));
  for (let i = 0; i < filtered.length; i++) {
    const stop = filtered[i];
    if (!stop.id) continue;
    const orig = originalById.get(stop.id);
    const order = i + 1;
    const changed =
      !orig ||
      orig.location !== stop.location ||
      orig.description !== stop.description ||
      orig.estimated_duration_minutes !== stop.estimated_duration_minutes ||
      (orig.image_url ?? null) !== (stop.image_url ?? null);

    if (!changed) continue;

    const { error } = await supabase
      .from('itinerary_stops')
      .update({
        stop_order: order,
        name: stop.location,
        description: stop.description,
        estimated_duration_minutes: stop.estimated_duration_minutes,
        image_url: stop.image_url ?? null,
      })
      .eq('id', stop.id);
    if (error) throw error;
  }
}

export async function deleteItinerary(itinId: string): Promise<void> {
  // Soft delete: distinct from "Pause" (is_published=false), which is reversible
  // and stays in the guide's list. Soft-deleted rows are hidden from every read
  // path via `.is('deleted_at', null)` filters in fetch* helpers.
  const { error } = await supabase
    .from('itineraries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itinId);

  if (error) throw error;
}
