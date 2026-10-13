import taxonomy from '../data/content-taxonomy.json';
import places from '../data/place-guides.json';
import { createContentRegistry, validateContentRegistry } from './content-registry.mjs';
import { getSitePages } from './site-pages';

export type ContentSection = 'explore' | 'plan' | 'detour' | 'utility';
export type ContentKind = 'place' | 'gallery' | 'guide' | 'tool' | 'hub' | 'home' | 'company' | 'legal' | 'account' | 'system' | 'resource';
export type ContentItem = {
  route: string;
  title: string;
  navigationTitle: string;
  summary: string;
  section: ContentSection;
  group: string;
  groupLabel: string;
  kind: ContentKind;
  parentRoute: string | null;
  tags: string[];
  aliases: string[];
  image?: string;
  region?: string;
  searchable: boolean;
  index: boolean;
  updatedAt: string;
  relatedRoutes: string[];
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
  contentSource: 'local' | 'sanity';
};

let contentPromise: Promise<ContentItem[]> | undefined;

async function resolveContent(): Promise<ContentItem[]> {
  const items = createContentRegistry({ pages: await getSitePages(), places, taxonomy });
  if (process.env.SANITY_PREVIEW_DRAFTS === 'true') for (const item of items) item.index = false;
  const errors = validateContentRegistry(items);
  if (errors.length) throw new Error(`Website content registry is invalid:\n${errors.join('\n')}`);
  return items;
}

/** One resolved source for navigation, hubs, breadcrumbs, public search and sitemap. */
export function getSiteContent(): Promise<ContentItem[]> {
  if (import.meta.env.DEV) return resolveContent();
  return contentPromise ??= resolveContent();
}
