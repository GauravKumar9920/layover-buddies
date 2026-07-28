import { supabase } from "../supabase";
import { PRIMARY_CITY } from "@/config/constants";
import type {
  GuideProfile,
  GuideProfilePhoto,
  GuideProfilePhotoRole,
  GuidePrompt,
  Itinerary,
  Review,
  StoryBlock,
  TourPrompt,
} from "@/types";

interface RawGuideProfileRow {
  id: string;
  user_id: string;
  university: string | null;
  hometown: string | null;
  bio: string | null;
  avg_rating: number | null;
  total_reviews: number | null;
  total_trips: number | null;
  is_active: boolean | null;
  profile_status?: string | null;
  profile_completed_at?: string | null;
  languages: unknown;
  skills: unknown;
  created_at: string;
  // Joined from users table
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  // Legacy fields (if present in older schemas/views)
  name?: string | null;
  avatar_url?: string | null;
  categories?: unknown;
  // Editorial-zine fields (migration 20260420160000)
  prompts?: unknown;
  pull_quote?: string | null;
  // Guide-uploaded photo gallery (migration 20260607120000)
  gallery_urls?: unknown;
  // Explicitly placed media (migration 20260726105000)
  profile_photos?: unknown;
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
  max_travelers: number | null;
  is_published: boolean | null;
  created_at: string;
  stops?: RawItineraryStopRow[];
  // Story-content fields (migration 20260420120000)
  story_blocks?: unknown;
  gallery_urls?: unknown;
  video_url?: string | null;
  video_duration_seconds?: number | null;
  // Hinge-style prompts (migration 20260420160000)
  prompts?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function toTagList(
  value: unknown,
  preferredKey: "language" | "name",
): string[] {
  if (!Array.isArray(value)) return [];

  const tags = value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const preferred = asString(record[preferredKey]);
      if (preferred) return preferred;

      return (
        asString(record.name) ??
        asString(record.language) ??
        asString(record.label)
      );
    })
    .filter((tag): tag is string => !!tag);

  return Array.from(new Set(tags));
}

export function normalizePromptArray(
  value: unknown,
): { question: string; answer: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const q = asString(rec.question);
      const a = asString(rec.answer);
      if (!q || !a) return null;
      return { question: q, answer: a };
    })
    .filter((p): p is { question: string; answer: string } => p !== null);
}

function normalizeGuideProfile(row: RawGuideProfileRow): GuideProfile {
  const fallbackName = row.university
    ? `${row.university} Guide`
    : `Mumbai Guide ${row.user_id.slice(0, 6)}`;

  // Prefer joined user data, then legacy direct fields, then fallback
  const resolvedName =
    asString(row.user?.full_name) ?? asString(row.name) ?? fallbackName;
  const resolvedAvatar = row.user?.avatar_url ?? row.avatar_url ?? null;

  return {
    // Keep app-facing guide id aligned with users.id (required by itineraries/bookings).
    profile_id: row.id,
    id: row.user_id,
    user_id: row.user_id,
    name: resolvedName,
    bio: row.bio ?? null,
    avatar_url: resolvedAvatar,
    portfolio_image_url: null,
    university: row.university ?? null,
    avg_rating: Number(row.avg_rating ?? 0),
    total_reviews: Number(row.total_reviews ?? 0),
    total_trips: Number(row.total_trips ?? 0),
    is_active: row.is_active ?? true,
    profile_status: row.profile_status === "draft" ? "draft" : "published",
    profile_completed_at: row.profile_completed_at ?? null,
    languages: toTagList(row.languages, "language"),
    hometown: asString(row.hometown),
    categories: row.categories
      ? toTagList(row.categories, "name")
      : toTagList(row.skills, "name"),
    created_at: row.created_at,
    prompts: normalizePromptArray(row.prompts) as GuidePrompt[],
    pull_quote: asString(row.pull_quote),
    gallery_urls: Array.isArray(row.gallery_urls)
      ? row.gallery_urls.filter((u): u is string => typeof u === "string")
      : [],
    profile_photos: normalizeGuideProfilePhotos(row.profile_photos),
  };
}

function normalizeGuideProfilePhotos(value: unknown): GuideProfilePhoto[] {
  if (!Array.isArray(value)) return [];

  const roleOrder: Record<GuideProfilePhotoRole, number> = {
    cover: 0,
    story: 1,
    gallery: 2,
  };

  return value
    .map((item): GuideProfilePhoto | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const role = row.role;
      if (role !== "cover" && role !== "story" && role !== "gallery")
        return null;
      if (
        typeof row.id !== "string" ||
        typeof row.guide_profile_id !== "string" ||
        typeof row.url !== "string"
      ) {
        return null;
      }

      return {
        id: row.id,
        guide_profile_id: row.guide_profile_id,
        role,
        storage_bucket:
          typeof row.storage_bucket === "string" ? row.storage_bucket : null,
        storage_path:
          typeof row.storage_path === "string" ? row.storage_path : null,
        url: row.url,
        caption: typeof row.caption === "string" ? row.caption : null,
        position: Number(row.position ?? 0),
        created_at: typeof row.created_at === "string" ? row.created_at : "",
        updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
      };
    })
    .filter((photo): photo is GuideProfilePhoto => photo !== null)
    .sort(
      (a, b) =>
        roleOrder[a.role] - roleOrder[b.role] || a.position - b.position,
    );
}

function normalizeStoryBlocks(value: unknown): StoryBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter((block): block is StoryBlock => {
    if (!block || typeof block !== "object") return false;
    const kind = (block as { kind?: unknown }).kind;
    return kind === "paragraph" || kind === "quote" || kind === "highlight";
  });
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}

function normalizeItinerary(row: RawItineraryRow): Itinerary {
  return {
    id: row.id,
    guide_id: row.guide_id,
    name: row.title ?? "Mumbai Tour",
    title: row.title ?? "Mumbai Tour",
    description: row.description ?? "",
    city: PRIMARY_CITY,
    category: row.category,
    image_url: row.cover_image_url ?? null,
    cover_image_url: row.cover_image_url ?? null,
    estimated_duration_hours: Number(row.duration_hours ?? 0),
    buddy_cost_inr: Number(row.buddy_cost ?? 0),
    max_travelers: Number(row.max_travelers ?? 1),
    is_active: row.is_published ?? false,
    created_at: row.created_at,
    stops: Array.isArray(row.stops)
      ? row.stops
          .map((stop) => ({
            id: stop.id,
            itinerary_id: stop.itinerary_id,
            order: Number(stop.stop_order ?? 0),
            location: stop.name ?? "Stop",
            description: stop.description ?? "",
            estimated_duration_minutes: Number(
              stop.estimated_duration_minutes ?? 0,
            ),
            image_url: stop.image_url ?? null,
          }))
          .sort((a, b) => a.order - b.order)
      : [],
    story_blocks: normalizeStoryBlocks(row.story_blocks),
    gallery_urls: normalizeStringArray(row.gallery_urls),
    video_url: row.video_url ?? null,
    video_duration_seconds:
      typeof row.video_duration_seconds === "number"
        ? row.video_duration_seconds
        : null,
    prompts: normalizePromptArray(row.prompts) as TourPrompt[],
  };
}

async function resolveGuideUserId(guideId: string): Promise<string> {
  const { data } = await supabase
    .from("guide_profiles")
    .select("user_id")
    .eq("id", guideId)
    .maybeSingle();

  return data?.user_id ?? guideId;
}

async function fetchGuideIdsByCity(_city: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("itineraries")
    .select("guide_id")
    .eq("is_published", true)
    .is("deleted_at", null);

  if (error) throw error;

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.guide_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
}

export async function fetchActiveGuides(
  city?: string,
): Promise<GuideProfile[]> {
  const targetCity = PRIMARY_CITY;
  const ids = await fetchGuideIdsByCity(targetCity);
  if (ids.length === 0) return [];

  const query = supabase
    .from("guide_profiles")
    .select(
      "*, user:users!user_id(id, full_name, avatar_url), profile_photos:guide_profile_photos(*)",
    )
    .eq("is_active", true)
    .eq("profile_status", "published")
    .in("user_id", ids)
    .order("avg_rating", { ascending: false });

  const { data, error } = await query.limit(30);
  if (error) throw error;
  return (
    (data as RawGuideProfileRow[] | null)?.map(normalizeGuideProfile) ?? []
  );
}

export async function fetchGuideById(
  guideId: string,
): Promise<GuideProfile | null> {
  const { data, error } = await supabase
    .from("guide_profiles")
    .select(
      "*, user:users!user_id(id, full_name, avatar_url), profile_photos:guide_profile_photos(*)",
    )
    .or(`id.eq.${guideId},user_id.eq.${guideId}`)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeGuideProfile(data as RawGuideProfileRow) : null;
}

export async function fetchItineraryById(
  id: string,
): Promise<Itinerary | null> {
  const { data, error } = await supabase
    .from("itineraries")
    .select("*, stops:itinerary_stops(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeItinerary(data as RawItineraryRow) : null;
}

export async function fetchGuideItineraries(
  guideId: string,
  includeUnpublished = false,
): Promise<Itinerary[]> {
  const resolvedGuideUserId = await resolveGuideUserId(guideId);

  let query = supabase
    .from("itineraries")
    .select("*, stops:itinerary_stops(*)")
    .eq("guide_id", resolvedGuideUserId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!includeUnpublished) {
    query = query.eq("is_published", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as RawItineraryRow[] | null)?.map(normalizeItinerary) ?? [];
}

export async function fetchGuideReviews(guideId: string): Promise<Review[]> {
  const resolvedGuideUserId = await resolveGuideUserId(guideId);

  const { data, error } = await supabase
    .from("reviews")
    .select("*, reviewer:users!reviewer_id(id, full_name, avatar_url)")
    .eq("reviewee_id", resolvedGuideUserId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as object),
    rating: (row.overall_rating as number) ?? 0,
    reviewer: row.reviewer
      ? {
          id: (row.reviewer as Record<string, unknown>).id,
          name: (row.reviewer as Record<string, unknown>).full_name,
          avatar_url: (row.reviewer as Record<string, unknown>).avatar_url,
        }
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
        guide.bio ?? "",
        guide.university ?? "",
        guide.hometown ?? "",
        ...guide.languages,
        ...guide.categories,
      ].some((value) => value.toLowerCase().includes(term)),
    )
    .slice(0, 20);
}

export async function updateGuideProfile(
  guideId: string,
  updates: Partial<Pick<GuideProfile, "name" | "avatar_url">>,
): Promise<void> {
  const { name, avatar_url } = updates;

  const { data: guideLookup } = await supabase
    .from("guide_profiles")
    .select("id, user_id")
    .or(`id.eq.${guideId},user_id.eq.${guideId}`)
    .maybeSingle();

  const userId = guideLookup?.user_id;

  if (name !== undefined || avatar_url !== undefined) {
    if (userId) {
      const userUpdates: Record<string, unknown> = {};
      if (name !== undefined) userUpdates.full_name = name;
      if (avatar_url !== undefined) userUpdates.avatar_url = avatar_url;

      const { error } = await supabase
        .from("users")
        .update(userUpdates)
        .eq("id", userId);
      if (error) throw error;
    }
  }
}

export interface PublishGuideProfileResult {
  published: boolean;
  missing: string[];
}

export interface SaveGuideProfileBuilderResult {
  profileStatus: "draft" | "published";
  autoDrafted: boolean;
  missing: string[];
}

export async function saveGuideProfileBuilder(input: {
  fullName: string;
  bio: string | null;
  languages: string[];
  university: string | null;
  hometown: string | null;
  pullQuote: string | null;
  prompts: GuidePrompt[];
  galleryPhotos: GuideProfilePhoto[];
}): Promise<SaveGuideProfileBuilderResult> {
  const { data, error } = await supabase.rpc(
    "save_my_guide_profile_builder_tx",
    {
      p_full_name: input.fullName,
      p_bio: input.bio,
      p_languages: input.languages,
      p_university: input.university,
      p_hometown: input.hometown,
      p_pull_quote: input.pullQuote,
      p_prompts: input.prompts,
      p_gallery: input.galleryPhotos.map((photo, position) => ({
        id: photo.id,
        caption: photo.caption?.trim() || null,
        position,
      })),
    },
  );
  if (error) throw error;

  const result =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    profileStatus:
      result.profile_status === "published" ? "published" : "draft",
    autoDrafted: result.auto_drafted === true,
    missing: Array.isArray(result.missing)
      ? result.missing.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

/** Server-authoritative publication gate. The RPC validates identity, story,
 * and explicit cover placement in one transaction before changing visibility. */
export async function publishGuideProfile(): Promise<PublishGuideProfileResult> {
  const { data, error } = await supabase.rpc("publish_my_guide_profile");
  if (error) throw error;

  const result =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    published: result.published === true,
    missing: Array.isArray(result.missing)
      ? result.missing.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

export async function moveGuideProfileToDraft(): Promise<void> {
  const { error } = await supabase.rpc("move_my_guide_profile_to_draft");
  if (error) throw error;
}

export async function setGuideAvailability(isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_my_guide_availability", {
    p_is_active: isActive,
  });
  if (error) throw error;
}
