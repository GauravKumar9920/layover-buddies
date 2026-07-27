/**
 * Centralised Supabase Storage upload helper.
 *
 * Consolidates the three near-identical upload blocks that previously
 * existed in create.tsx, [id].tsx, and profile.tsx.
 */

import { Platform } from "react-native";
import { supabase } from "./supabase";

interface UploadImageParams {
  /**
   * Image bytes to upload. Web hands us a Blob/File; native hands us an
   * ArrayBuffer (RN Blobs upload an empty body and fail with "Network request
   * failed"). Supabase Storage accepts either.
   */
  blob: Blob | ArrayBuffer;
  /** Storage bucket name, e.g. 'itinerary-photos' or 'avatars' */
  bucket: string;
  /** Storage path inside the bucket, e.g. `${userId}/${Date.now()}.jpg` */
  path: string;
  contentType: string;
  /**
   * On web the caller obtained a blob: URL from pickImage().
   * Pass that URI here and it will be revoked after a successful upload
   * to prevent blob-URL memory leaks in long-lived sessions.
   */
  blobUri?: string;
}

interface UploadResult {
  publicUrl: string;
}

/**
 * Upload a Blob to Supabase Storage and return the public URL.
 * Throws an Error if the upload fails.
 */
export async function uploadImage({
  blob,
  bucket,
  path,
  contentType,
  blobUri,
}: UploadImageParams): Promise<UploadResult> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { upsert: true, contentType });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { publicUrl: data.publicUrl };
  } finally {
    // The picker owns no later use for this temporary URL. Revoke on both
    // success and failure so repeated failed uploads cannot leak browser memory.
    if (Platform.OS === "web" && blobUri && blobUri.startsWith("blob:")) {
      URL.revokeObjectURL(blobUri);
    }
  }
}
