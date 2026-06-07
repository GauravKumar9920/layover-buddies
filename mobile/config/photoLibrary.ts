import type { GuideProfile, Itinerary } from '@/types';

const MUMBAI_CITY_PHOTOS = [
  'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1586500036706-41963de24d8b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80',
];

const CITY_PHOTOS: Record<string, string[]> = {
  mumbai: MUMBAI_CITY_PHOTOS,
};

// Curated, friendly student-guide portraits. Seeded guides have a null
// `avatar_url`, so without a fallback every card/detail screen would show
// bare initials. We pick one deterministically per guide (by id) so the same
// face follows a guide everywhere — same approach as the hero-photo fallback.
const GUIDE_PORTRAITS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
];

// A broad pool of Mumbai "walk moments" (street, food, architecture, people,
// markets) used to fill photo-forward profile sections — the masonry journal,
// extra hero slides, the day timeline, and prompt-card imagery. Seeded tours
// have no real gallery_urls yet, so these keep every profile looking complete;
// real uploaded galleries take precedence wherever they exist.
const MUMBAI_SCENES = [
  'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1586500036706-41963de24d8b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=900&q=80',
];

const CATEGORY_PHOTOS: Record<string, string[]> = {
  food: [
    'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=1200&q=80',
  ],
  history: [
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80',
  ],
  culture: [
    'https://images.unsplash.com/photo-1586500036706-41963de24d8b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=1200&q=80',
  ],
  photography: [
    'https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=1200&q=80',
  ],
  art: [
    'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1200&q=80',
  ],
  nature: [
    'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80',
  ],
  adventure: [
    'https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=1200&q=80',
  ],
  shopping: [
    'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80',
  ],
};

function normalizeKey(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
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
  if (guide.portfolio_image_url) return guide.portfolio_image_url;
  if (guide.avatar_url) return guide.avatar_url;

  const cityKey = normalizeKey(guide.hometown);
  const cityPool = CITY_PHOTOS[cityKey] ?? MUMBAI_CITY_PHOTOS;
  const seed = `${guide.id ?? ''}-${guide.name ?? ''}-${guide.hometown ?? ''}`;
  return pickSeededPhoto(cityPool, seed);
}

/** The guide's headshot for the circular avatar shown above their name.
 *  Uses their uploaded `avatar_url` when present, else a stable curated
 *  portrait seeded by `id` + `name` so the same face appears on the card and
 *  the detail screen. Returns null only when both id and name are empty. */
export function getGuideAvatar(guide: Partial<GuideProfile>): string | null {
  if (guide.avatar_url) return guide.avatar_url;
  const seed = `${guide.id ?? ''}-${guide.name ?? ''}`;
  if (!seed.trim()) return null;
  return pickSeededPhoto(GUIDE_PORTRAITS, seed);
}

/** A deterministic set of `count` distinct "walk moment" photos for a guide,
 *  used to populate the photo-forward profile sections. Seeded by guide id so
 *  the same guide always gets the same gallery, and rotated so different guides
 *  start at different points in the pool (less repetition between profiles).
 *  Pass `exclude` to avoid repeating the hero/portrait already shown. */
export function getGuideGallery(
  guide: Partial<GuideProfile>,
  count = 6,
  exclude: (string | null | undefined)[] = [],
): string[] {
  const skip = new Set(exclude.filter(Boolean) as string[]);
  const out: string[] = [];

  // Real guide-uploaded photos win — these are what the guide built.
  (guide.gallery_urls ?? []).forEach((u) => {
    if (u && !skip.has(u) && !out.includes(u)) out.push(u);
  });

  // Top up with curated scenes so the section never looks sparse.
  const seed = `${guide.id ?? ''}-${guide.name ?? ''}`;
  const start = hashSeed(seed || 'mumbai');
  for (let i = 0; i < MUMBAI_SCENES.length && out.length < count; i += 1) {
    const photo = MUMBAI_SCENES[(start + i) % MUMBAI_SCENES.length];
    if (!skip.has(photo) && !out.includes(photo)) out.push(photo);
  }
  return out.slice(0, count);
}

export function getItineraryPhoto(itinerary: Partial<Itinerary>): string | null {
  if (itinerary.image_url) return itinerary.image_url;
  if (itinerary.cover_image_url) return itinerary.cover_image_url;

  const categoryKey = normalizeKey(itinerary.category);
  const byCategory = CATEGORY_PHOTOS[categoryKey];
  if (byCategory?.length) {
    return pickSeededPhoto(byCategory, `${itinerary.id ?? ''}-${itinerary.name ?? itinerary.title ?? ''}`);
  }

  const cityKey = normalizeKey(itinerary.city);
  const cityPool = CITY_PHOTOS[cityKey] ?? MUMBAI_CITY_PHOTOS;
  return pickSeededPhoto(cityPool, `${itinerary.id ?? ''}-${itinerary.name ?? itinerary.title ?? ''}-${itinerary.city ?? ''}`);
}
