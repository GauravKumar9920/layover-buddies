import type { ContentItem, ContentSection } from './site-content';
import type { SanityPage, SitePage } from './site-pages';

/** Input metadata may come from JSON or CMS data; runtime normalisation validates it. */
export interface ContentMetadata {
  section: string;
  group: string;
  navigationTitle?: string;
  kind?: string;
  parentRoute?: string | null;
  tags?: readonly string[];
  aliases?: readonly string[];
  relatedRoutes?: readonly string[];
  searchable?: boolean;
}

export interface PlaceMetadata {
  slug: string;
  name: string;
  lead?: string;
  region?: string;
  themes?: readonly string[];
  photos?: ReadonlyArray<{ src: string }>;
}

export const CONTENT_SECTIONS: readonly ContentSection[];
export const SECTION_LABELS: Record<ContentSection, string>;
export const GROUP_LABELS: Record<string, string>;
export const SECTION_GROUPS: Record<ContentSection, readonly string[]>;

export function normalizeContentRoute(value: unknown): string | undefined;
export function editableCmsRoute(value: unknown): string | undefined;
export function normalizeDiscovery(value: unknown): SitePage['discovery'];
export function cmsContentCanPublish(remote: unknown, fallback?: SitePage, options?: { previewDrafts?: boolean }): boolean;
export function normalizeCmsDocument(value: unknown): SanityPage | undefined;
export function createContentRegistry(options: {
  pages: readonly SitePage[];
  places?: readonly PlaceMetadata[];
  taxonomy?: Record<string, ContentMetadata>;
  includeResources?: boolean;
}): ContentItem[];
export function validateContentRegistry(items: readonly ContentItem[]): string[];
