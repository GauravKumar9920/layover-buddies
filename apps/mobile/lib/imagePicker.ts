/**
 * Cross-platform image picker.
 *
 * On native (iOS / Android): delegates to expo-image-picker.
 * On web: falls back to a programmatic <input type="file"> because
 *   expo-image-picker's web support is a no-op on some Expo SDK / browser
 *   combinations.
 *
 * Note: `aspect`, `quality`, and `allowsEditing` are honoured on native.
 * On web they are silently ignored — a crop/resize library would be needed
 * to replicate them, which is out of scope for MVP.
 */

import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

export interface PickedImage {
  /** file:// URI on native; blob: URL on web (revoke after use) */
  uri: string;
  /**
   * Upload-ready image bytes, ready to pass directly to Supabase Storage.
   * Native: an ArrayBuffer read via `fetch(uri).arrayBuffer()`. React Native's
   *   Blob streams an empty body to Storage and fails with "Network request
   *   failed", so we hand Storage raw bytes instead.
   * Web: the picked File (which is a Blob) — uploads fine as-is.
   */
  blob: Blob | ArrayBuffer;
  mimeType: string;
  /** Suggested file name with extension */
  fileName: string;
  width: number;
  height: number;
}

interface PickOptions {
  aspect?: [number, number];
  quality?: number;
  allowsEditing?: boolean;
}

/**
 * Open the image library and return a PickedImage, or null if the user
 * cancelled. Throws on unexpected errors.
 */
export async function pickImage(
  opts: PickOptions = {},
): Promise<PickedImage | null> {
  const { aspect = [1, 1], quality = 0.8, allowsEditing = true } = opts;

  if (Platform.OS === "web") {
    return pickImageWeb();
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing,
    aspect,
    quality,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const uri = asset.uri;

  // Read the file as an ArrayBuffer (not a Blob): RN's Blob uploads an empty
  // body to Supabase Storage and fails with "Network request failed".
  const response = await fetch(uri);
  const blob = await response.arrayBuffer();

  const ext = uri.split(".").pop() ?? "jpg";
  const mimeType = asset.mimeType ?? `image/${ext}`;
  const fileName = `photo_${Date.now()}.${ext}`;

  return {
    uri,
    blob,
    mimeType,
    fileName,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
  };
}

/**
 * Open the image library allowing MULTIPLE selections. Returns every picked
 * image, or an empty array if cancelled. Used by the guide photo gallery.
 * Note: native multi-select disables per-image cropping (expo limitation).
 */
export async function pickImages(
  opts: { quality?: number; limit?: number } = {},
): Promise<PickedImage[]> {
  const { quality = 0.8, limit = 10 } = opts;

  if (Platform.OS === "web") {
    return pickImagesWeb(limit);
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    // iOS otherwise does not guarantee that result.assets matches the order
    // the guide tapped. Journal order is authored content, so preserve it.
    orderedSelection: true,
    selectionLimit: limit,
    quality,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });

  if (result.canceled || result.assets.length === 0) return [];

  return Promise.all(
    result.assets.map(async (asset) => {
      // ArrayBuffer, not Blob — see pickImage() for why RN Blobs fail to upload.
      const response = await fetch(asset.uri);
      const blob = await response.arrayBuffer();
      const ext = asset.uri.split(".").pop() ?? "jpg";
      return {
        uri: asset.uri,
        blob,
        mimeType: asset.mimeType ?? `image/${ext}`,
        fileName:
          asset.fileName ??
          `photo_${Date.now()}_${Math.round(asset.width ?? 0)}.${ext}`,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      };
    }),
  );
}

/**
 * Mount a hidden file input, open it, and keep it alive until the browser
 * reports a result.
 *
 * The input MUST stay in the document while the OS file chooser is open.
 * WebKit discards the selection and never fires `change` if the element is
 * detached in the meantime, so the old `requestAnimationFrame(() =>
 * removeChild(input))` meant picking a photo in Safari did precisely nothing:
 * no file, no error, no upload. Chrome kept working, which is why it went
 * unnoticed.
 *
 * `settle` is invoked exactly once, with the input removed by then.
 */
function openFileInput(
  configure: (input: HTMLInputElement) => void,
  onResult: (input: HTMLInputElement) => void,
  onDismiss: () => void,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  // Off-screen rather than display:none — Safari refuses to open the chooser
  // for an input that is not rendered.
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.opacity = "0";
  configure(input);

  let settled = false;
  const cleanup = () => {
    if (input.parentNode) input.parentNode.removeChild(input);
  };

  input.addEventListener("change", () => {
    if (settled) return;
    settled = true;
    // Read `files` before detaching; some browsers clear it on removal.
    onResult(input);
    cleanup();
  });

  // Fired when the chooser is dismissed without a selection (Chrome 113+,
  // Safari 16.4+). Older browsers simply leave the element mounted until the
  // next pick replaces it — a few bytes, and far better than a lost photo.
  input.addEventListener("cancel", () => {
    if (settled) return;
    settled = true;
    onDismiss();
    cleanup();
  });

  document.body.appendChild(input);
  input.click();
}

/** Web-only multi-select via <input type="file" multiple>. */
function pickImagesWeb(limit: number): Promise<PickedImage[]> {
  return new Promise((resolve) => {
    openFileInput(
      (input) => {
        input.multiple = true;
      },
      (input) => {
        const files = Array.from(input.files ?? []).slice(0, limit);
        resolve(
          files.map((file) => ({
            uri: URL.createObjectURL(file),
            blob: file,
            mimeType: file.type || "image/jpeg",
            fileName: file.name || `photo_${Date.now()}.jpg`,
            width: 0,
            height: 0,
          })),
        );
      },
      () => resolve([]),
    );
  });
}

/** Web-only: use a hidden <input type="file"> to open the OS file picker. */
function pickImageWeb(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    openFileInput(
      () => {},
      (input) => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        const uri = URL.createObjectURL(file);
        const mimeType = file.type || "image/jpeg";
        const fileName = file.name || `photo_${Date.now()}.jpg`;

        // Read image dimensions via an off-DOM <img>.
        // Use HTMLImageElement constructor explicitly to avoid a name collision
        // with React Native's <Image> component when DOM lib is included.
        const img = new globalThis.Image();
        img.onload = () => {
          resolve({
            uri,
            blob: file, // File extends Blob — no copy needed
            mimeType,
            fileName,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        };
        img.onerror = () => {
          // Still resolve with 0×0 — dimensions are not critical for upload
          resolve({
            uri,
            blob: file,
            mimeType,
            fileName,
            width: 0,
            height: 0,
          });
        };
        img.src = uri;
      },
      () => resolve(null),
    );
  });
}
