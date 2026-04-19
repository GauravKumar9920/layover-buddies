import { supabase } from '../supabase';
import { PRIMARY_CITY } from '@/config/constants';
import type { GuideProfile, Itinerary, Review } from '@/types';

interface RawGuideProfileRow {
  id: string;
  user_id: string;
  university: string | null;
  bio: string | null;
  avg_rating: number | null;
  total_reviews: number | null;
  is_active: boolean | null;
  languages: unknown;
  skills: unknown;
  created_at: string;
  // Joined from users table
  user?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  // Legacy fields (if present in older schemas/views)
  name?: string | null;
  avatar_url?: string | null;
  hometown?: string | null;
  categories?: unknown;
}

interface RawItineraryStopRow {
  id: string;
  itinerary_id: string;
  stop_order: number | null;
  name: string | null;
  description: string | null;
  estimated_duration_minutes: number | null;
  image_url?: string | null;
}

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
  stops?: RawItineraryStopRow[];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toTagList(value: unknown, preferredKey: 'language' | 'name'): string[] {
  if (!Array.isArray(value)) return [];

  const tags = value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;
      const preferred = asString(record[preferredKey]);
      if (preferred) return preferred;

      return asString(record.name) ?? asString(record.language) ?? asString(record.label);
    })
    .filter((tag): tag is string => !!tag);

  return Array.from(new Set(tags));
}

function normalizeGuideProfile(row: RawGuideProfileRow): GuideProfile {
  const fallbackName = row.university
    ? `${row.university} Guide`
    : `Mumbai Guide ${row.user_id.slice(0, 6)}`;

  // Prefer joined user data, then legacy direct fields, then fallback
  const resolvedName = asString(row.user?.full_name) ?? asString(row.name) ?? fallbackName;
  const resolvedAvatar = row.user?.avatar_url ?? row.avatar_url ?? null;

  return {
    // Keep app-facing guide id aligned with users.id (required by itineraries/bookings).
    id: row.user_id,
    user_id: row.user_id,
    name: resolvedName,
    bio: row.bio ?? null,
    avatar_url: resolvedAvatar,
    portfolio_image_url: null,
    university: row.university ?? null,
    avg_rating: Number(row.avg_rating ?? 0),
    total_reviews: Number(row.total_reviews ?? 0),
    is_active: row.is_active ?? true,
    languages: toTagList(row.languages, 'language'),
    hometown: asString(row.hometown),
    categories: row.categories ? toTagList(row.categories, 'name') : toTagList(row.skills, 'name'),
    created_at: row.created_at,
  };
}

function normalizeItinerary(row: RawItineraryRow): Itinerary {
  return {
    id: row.id,
    guide_id: row.guide_id,
    name: row.title ?? 'Mumbai Tour',
    title: row.title ?? 'Mumbai Tour',
    description: row.description ?? '',
    city: PRIMARY_CITY,
    category: row.category,
    image_url: row.cover_image_url ?? null,
    cover_image_url: row.cover_image_url ?? null,
    estimated_duration_hours: Number(row.duration_hours ?? 0),
    buddy_cost_inr: Number(row.buddy_cost ?? 0),
    max_travelers: 1,
    is_active: row.is_published ?? false,
    created_at: row.created_at,
    stops: Array.isArray(row.stops)
      ? row.stops.map((stop) => ({
          id: stop.id,
          itinerary_id: stop.itinerary_id,
          order: Number(stop.stop_order ?? 0),
          location: stop.name ?? 'Stop',
          description: stop.description ?? '',
          estimated_duration_minutes: Number(stop.estimated_duration_minutes ?? 0),
          image_url: stop.image_url ?? null,
        }))
      : [],
  };
}

async function resolveGuideUserId(guideId: string): Promise<string> {
  const { data } = await supabase
    .from('guide_profiles')
    .select('user_id')
    .eq('id', guideId)
    .maybeSingle();

  return data?.user_id ?? guideId;
}

async function fetchGuideIdsByCity(_city: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('itineraries')
    .select('guide_id')
    .eq('is_published', true);

  if (error) throw error;

  return Array.from(
    new Set((data ?? []).map((row) => row.guide_id).filter((id): id is string => typeof id === 'string' && id.length > 0)),
  );
}

export async function fetchActiveGuides(city?: string): Promise<GuideProfile[]> {
  const targetCity = PRIMARY_CITY;
  const ids = await fetchGuideIdsByCity(targetCity);
  if (ids.length === 0) return [];

  const query = supabase
    .from('guide_profiles')
    .select('*, user:users!user_id(id, full_name, avatar_url)')
    .eq('is_active', true)
    .in('user_id', ids)
    .order('avg_rating', { ascending: false });

  const { data, error } = await query.limit(30);
  if (error) throw error;
  return (data as RawGuideProfileRow[] | null)?.map(normalizeGuideProfile) ?? [];
}

export async function fetchGuideById(guideId: string): Promise<GuideProfile | null> {
  const { data, error } = await supabase
    .from('guide_profiles')
    .select('*, user:users!user_id(id, full_name, avatar_url)')
    .or(`id.eq.${guideId},user_id.eq.${guideId}`)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeGuideProfile(data as RawGuideProfileRow) : null;
}

export async function fetchGuideItineraries(guideId: string, includeUnpublished = false): Promise<Itinerary[]> {
  const resolvedGuideUserId = await resolveGuideUserId(guideId);

  let query = supabase
    .from('itineraries')
    .select('*, stops:itinerary_stops(*)')
    .eq('guide_id', resolvedGuideUserId)
    .order('created_at', { ascending: false });

  if (!includeUnpublished) {
    query = query.eq('is_published', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as RawItineraryRow[] | null)?.map(normalizeItinerary) ?? [];
}

export async function fetchGuideReviews(guideId: string): Promise<Review[]> {
  const resolvedGuideUserId = await resolveGuideUserId(guideId);

  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:users!reviewer_id(id, full_name, avatar_url)')
    .eq('reviewee_id', resolvedGuideUserId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as object),
    rating: (row.overall_rating as number) ?? 0,
    reviewer: row.reviewer
      ? { id: (row.reviewer as Record<string, unknown>).id, name: (row.reviewer as Record<string, unknown>).full_name, avatar_url: (row.reviewer as Record<string, unknown>).avatar_url }
      : undefined,
  })) as Review[];
}

export async function searchGuides(query: string): Promise<GuideProfile[]> {
  const term = query.trim().toLowerCase();
  const guides = await fetchActiveGuides(PRIMARY_CITY);
  if (!term) return guides;

  return guides
    .filter((guide) =>
      [
        guide.name,
        guide.bio ?? '',
        guide.university ?? '',
        ...guide.languages,
        ...guide.categories,
      ].some((value) => value.toLowerCase().includes(term)),
    )
    .slice(0, 20);
}

export async function updateGuideProfile(
  guideId: string,
  updates: Partial<Pick<GuideProfile, 'name' | 'bio' | 'avatar_url' | 'languages' | 'hometown' | 'is_active'>>,
): Promise<void> {
  // name and avatar_url live on the users table, not guide_profiles.
  // hometown does not exist in the schema — ignored.
  const { name, avatar_url, hometown: _hometown, ...guideUpdates } = updates;

  const { data: guideLookup } = await supabase
    .from('guide_profiles')
    .select('id, user_id')
    .or(`id.eq.${guideId},user_id.eq.${guideId}`)
    .maybeSingle();

  const profileId = guideLookup?.id ?? guideId;
  const userId = guideLookup?.user_id;

  if (Object.keys(guideUpdates).length > 0) {
    const { error } = await supabase
      .from('guide_profiles')
      .update(guideUpdates)
      .eq('id', profileId);
    if (error) throw error;
  }

  if (name !== undefined || avatar_url !== undefined) {
    if (userId) {
      const userUpdates: Record<string, unknown> = {};
      if (name !== undefined) userUpdates.full_name = name;
      if (avatar_url !== undefined) userUpdates.avatar_url = avatar_url;

      const { error } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', userId);
      if (error) throw error;
    }
  }
}
