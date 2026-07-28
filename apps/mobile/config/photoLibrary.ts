import type { GuideProfile, Itinerary } from "@/types";

const MUMBAI_CITY_PHOTOS = [
  "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1586500036706-41963de24d8b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
];

const CITY_PHOTOS: Record<string, string[]> = {
  mumbai: MUMBAI_CITY_PHOTOS,
};

const CATEGORY_PHOTOS: Record<string, string[]> = {
  food: [
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=1200&q=80",
  ],
  history: [
    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80",
  ],
  culture: [
    "https://images.unsplash.com/photo-1586500036706-41963de24d8b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=1200&q=80",
  ],
  photography: [
    "https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=1200&q=80",
  ],
  art: [
    "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1200&q=80",
  ],
  nature: [
    "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80",
  ],
  adventure: [
    "https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=1200&q=80",
  ],
  shopping: [
    "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80",
  ],
};

function normalizeKey(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickSeededPhoto(photos: string[], seed: string): string | null {
  if (!photos.length) return null;
  const idx = hashSeed(seed) % photos.length;
  return photos[idx];
}

export function getGuideHeroPhoto(guide: Partial<GuideProfile>): string | null {
  const cover = (guide.profile_photos ?? [])
    .filter((photo) => photo.role === "cover")
    .sort((a, b) => a.position - b.position)[0];
  if (cover?.url) return cover.url;
  if (guide.portfolio_image_url) return guide.portfolio_image_url;
  return null;
}

/** The guide's headshot for the circular avatar shown above their name.
 *  Never invent a face for a real person: missing identity media renders as
 *  initials in the caller. */
export function getGuideAvatar(guide: Partial<GuideProfile>): string | null {
  return guide.avatar_url ?? null;
}

/** The single optional image explicitly assigned to the guide's story/quote. */
export function getGuideStoryPhoto(
  guide: Partial<GuideProfile>,
): string | null {
  return (
    (guide.profile_photos ?? [])
      .filter((photo) => photo.role === "story")
      .sort((a, b) => a.position - b.position)[0]?.url ?? null
  );
}

/** Ordered profile-journal rows. These are never reused as covers, prompt
 * imagery, tour media, or stop photos. The structured relation is the only
 * source of profile-journal media after migration; an empty relation is an
 * intentional empty journal and must not resurrect legacy gallery_urls. */
export function getGuideJournalPhotos(guide: Partial<GuideProfile>) {
  return (guide.profile_photos ?? [])
    .filter((photo) => photo.role === "gallery")
    .sort((a, b) => a.position - b.position);
}

/** @deprecated Use getGuideJournalPhotos; retained so older callers cannot
 * silently regain the previous cross-placement behavior. */
export function getGuideGallery(
  guide: Partial<GuideProfile>,
  count = 6,
  exclude: (string | null | undefined)[] = [],
): string[] {
  const skip = new Set(exclude.filter(Boolean) as string[]);
  return getGuideJournalPhotos(guide)
    .map((photo) => photo.url)
    .filter((url) => !skip.has(url))
    .slice(0, count);
}

export function getItineraryPhoto(
  itinerary: Partial<Itinerary>,
): string | null {
  if (itinerary.image_url) return itinerary.image_url;
  if (itinerary.cover_image_url) return itinerary.cover_image_url;

  const categoryKey = normalizeKey(itinerary.category);
  const byCategory = CATEGORY_PHOTOS[categoryKey];
  if (byCategory?.length) {
    return pickSeededPhoto(
      byCategory,
      `${itinerary.id ?? ""}-${itinerary.name ?? itinerary.title ?? ""}`,
    );
  }

  const cityKey = normalizeKey(itinerary.city);
  const cityPool = CITY_PHOTOS[cityKey] ?? MUMBAI_CITY_PHOTOS;
  return pickSeededPhoto(
    cityPool,
    `${itinerary.id ?? ""}-${itinerary.name ?? itinerary.title ?? ""}-${itinerary.city ?? ""}`,
  );
}
