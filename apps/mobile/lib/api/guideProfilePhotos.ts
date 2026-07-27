import { supabase } from "../supabase";
import type { GuideProfilePhoto, GuideProfilePhotoRole } from "@/types";

interface SaveGuideProfilePhotoInput {
  guideProfileId: string;
  role: GuideProfilePhotoRole;
  url: string;
  storageBucket?: string | null;
  storagePath?: string | null;
  caption?: string | null;
  position?: number;
}

function normalizePhoto(row: Record<string, unknown>): GuideProfilePhoto {
  return {
    id: String(row.id),
    guide_profile_id: String(row.guide_profile_id),
    role: row.role as GuideProfilePhotoRole,
    storage_bucket:
      typeof row.storage_bucket === "string" ? row.storage_bucket : null,
    storage_path:
      typeof row.storage_path === "string" ? row.storage_path : null,
    url: String(row.url),
    caption: typeof row.caption === "string" ? row.caption : null,
    position: Number(row.position ?? 0),
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

export async function fetchGuideProfilePhotos(
  guideProfileId: string,
): Promise<GuideProfilePhoto[]> {
  const { data, error } = await supabase
    .from("guide_profile_photos")
    .select("*")
    .eq("guide_profile_id", guideProfileId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) =>
    normalizePhoto(row as Record<string, unknown>),
  );
}

/**
 * Saves a single declared profile placement. Cover and story are single-slot
 * roles, so saving either updates the existing row instead of creating a
 * second ambiguous image. Gallery rows are always appended as new items.
 */
export async function saveGuideProfilePhoto(
  input: SaveGuideProfilePhotoInput,
): Promise<GuideProfilePhoto> {
  const payload = {
    guide_profile_id: input.guideProfileId,
    role: input.role,
    storage_bucket: input.storageBucket ?? null,
    storage_path: input.storagePath ?? null,
    url: input.url,
    caption: input.caption?.trim() || null,
    position: input.position ?? 0,
  };

  if (input.role !== "gallery") {
    const { data: existing, error: lookupError } = await supabase
      .from("guide_profile_photos")
      .select("id, storage_bucket, storage_path")
      .eq("guide_profile_id", input.guideProfileId)
      .eq("role", input.role)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("guide_profile_photos")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;

      const oldBucket =
        typeof existing.storage_bucket === "string"
          ? existing.storage_bucket
          : null;
      const oldPath =
        typeof existing.storage_path === "string"
          ? existing.storage_path
          : null;
      if (
        oldBucket &&
        oldPath &&
        (oldBucket !== payload.storage_bucket ||
          oldPath !== payload.storage_path)
      ) {
        const { error: cleanupError } = await supabase.storage
          .from(oldBucket)
          .remove([oldPath]);
        if (cleanupError && typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn(
            "[guide profile] Replaced-photo cleanup failed:",
            cleanupError.message,
          );
        }
      }

      return normalizePhoto(data as Record<string, unknown>);
    }
  }

  const { data, error } = await supabase
    .from("guide_profile_photos")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return normalizePhoto(data as Record<string, unknown>);
}

/**
 * Removes the placement first, then best-effort removes the owned Storage
 * object. A legacy/external URL has no storage path and is DB-only.
 */
export async function deleteGuideProfilePhoto(
  photo: GuideProfilePhoto,
): Promise<void> {
  const { error } = await supabase
    .from("guide_profile_photos")
    .delete()
    .eq("id", photo.id);
  if (error) throw error;

  if (photo.storage_bucket && photo.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(photo.storage_bucket)
      .remove([photo.storage_path]);
    if (storageError && typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[guide profile] Storage cleanup failed:",
        storageError.message,
      );
    }
  }
}
