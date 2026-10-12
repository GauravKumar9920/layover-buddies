import { getCollection, type CollectionEntry } from 'astro:content';
import { cmsContentCanPublish, normalizeContentRoute, normalizeDiscovery, normalizeCmsDocument } from './content-registry.mjs';

export type PortableTextSpan = {
  _key?: string;
  _type?: string;
  text?: string;
  marks?: string[];
};

export type PortableTextBlock = {
  _key?: string;
  _type?: string;
  style?: string;
  level?: number;
  listItem?: 'bullet' | 'number';
  children?: PortableTextSpan[];
  markDefs?: Array<{ _key: string; _type: string; href?: string }>;
  asset?: { url?: string; alt?: string };
};

export type SitePage = CollectionEntry<'pages'>['data'] & {
  id: string;
  contentSource: 'local' | 'sanity';
  structuredBody?: PortableTextBlock[];
  faqs?: Array<{ question: string; answer: string }>;
  eyebrow?: string;
  heroMedia?: { url: string; alt: string; caption?: string; credit?: string };
  testimonials?: Array<{ quote: string; travellerName: string; travellerContext?: string; verified?: boolean }>;
  founderNote?: string;
  cta?: { label: string; destination: string };
  featuredContent?: Array<{ title: string; route: string }>;
  sourceLinks?: Array<{ label: string; url: string; checkedAt?: string }>;
  previewDraft?: boolean;
};

export type SanityPage = {
  _id: string;
  _type: 'guide' | 'landingPage';
  route?: string;
  slug?: string;
  title?: string;
  description?: string;
  publishedAt?: string;
  updatedAt?: string;
  body?: PortableTextBlock[];
  faqs?: Array<{ question?: string; answer?: string }>;
  eyebrow?: string;
  author?: string;
  reviewer?: string;
  heroMedia?: { url?: string; alt?: string; caption?: string; credit?: string };
  testimonials?: Array<{ quote?: string; travellerName?: string; travellerContext?: string; verified?: boolean }>;
  founderNote?: string;
  cta?: { label?: string; destination?: string };
  featuredContent?: Array<{ title?: string; slug?: string }>;
  sourceLinks?: Array<{ label?: string; url?: string; checkedAt?: string }>;
  discovery?: unknown;
  seo?: {
    title?: string;
    description?: string;
    socialTitle?: string;
    socialDescription?: string;
    imageUrl?: string;
    noIndex?: boolean;
  };
};

// Legal text is reviewed and deployed with the application. A CMS document
// must never replace these routes, even if an editor bypasses Studio validation.
const CODE_CONTROLLED_ROUTES = new Set(['/privacy', '/terms']);

function normalizeRoute(value: string | undefined): string | undefined {
  const route = normalizeContentRoute(value);
  return route && !route.includes('.') ? route : undefined;
}

async function loadSanityPages(): Promise<SanityPage[]> {
  const projectId = (import.meta.env.PUBLIC_SANITY_PROJECT_ID || process.env.PUBLIC_SANITY_PROJECT_ID || '').trim();
  const dataset = (import.meta.env.PUBLIC_SANITY_DATASET || process.env.PUBLIC_SANITY_DATASET || 'production').trim();
  const apiVersion = (process.env.SANITY_API_VERSION || '2026-08-01').trim();
  const token = process.env.SANITY_READ_TOKEN?.trim();
  const previewDrafts = process.env.SANITY_PREVIEW_DRAFTS === 'true';

  if (previewDrafts && (!projectId || !token)) {
    throw new Error('SANITY_PREVIEW_DRAFTS requires PUBLIC_SANITY_PROJECT_ID and SANITY_READ_TOKEN');
  }
  if (!projectId) return [];
  if (!/^[a-z0-9-]+$/i.test(projectId) || !/^[a-z0-9_-]+$/i.test(dataset)) {
    console.warn('[marketing] Ignoring invalid Sanity project or dataset configuration.');
    return [];
  }

  const draftFilter = previewDrafts ? '' : ' && !(_id in path("drafts.**"))';
  const query = `*[_type in ["guide", "landingPage"]${draftFilter} && !(_type == "landingPage" && path in ["/privacy", "/privacy/", "/terms", "/terms/"]) ]{
    _id,
    _type,
    "route": select(_type == "guide" => "/guides/" + slug.current, path),
    "slug": slug.current,
    title,
    description,
    publishedAt,
    "updatedAt": coalesce(updatedAt, _updatedAt),
    eyebrow,
    author,
    reviewer,
    discovery{section, group, kind, navigationTitle, parentRoute, tags, aliases, relatedRoutes, searchable},
    "heroMedia": {"url": heroMedia.image.asset->url, "alt": heroMedia.alt, "caption": heroMedia.caption, "credit": heroMedia.credit},
    body[]{..., _type == "image" => {"asset": {"url": asset->url, "alt": coalesce(alt, "")}}},
    faqs[]{question, answer},
    testimonials[]{quote, travellerName, travellerContext, verified},
    founderNote,
    cta{label, destination},
    "featuredContent": featuredContent[]->{title, "slug": slug.current},
    sourceLinks[]{label, url, checkedAt},
    "seo": {
      "title": seo.title,
      "description": seo.description,
      "socialTitle": seo.socialTitle,
      "socialDescription": seo.socialDescription,
      "imageUrl": seo.socialImage.asset->url,
      "noIndex": seo.noIndex
    }
  }`;
  const perspective = previewDrafts ? '&perspective=drafts' : '';
  const endpoint = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}${perspective}`;

  try {
    const response = await fetch(endpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { result?: SanityPage[] };
    return Array.isArray(payload.result) ? payload.result.map(normalizeCmsDocument).filter((page): page is SanityPage => page !== undefined) : [];
  } catch (error) {
    if (previewDrafts) throw error;
    console.warn(`[marketing] Sanity content unavailable; using local fallback (${String(error)}).`);
    return [];
  }
}

async function resolveSitePages(): Promise<SitePage[]> {
  const entries = await getCollection('pages');
  const local: SitePage[] = entries.map((entry) => ({
    id: entry.id,
    ...entry.data,
    contentSource: 'local' as const,
  }));
  const byRoute = new Map<string, SitePage>(local.map((entry) => [entry.route, entry]));

  function safeDestination(value: string | undefined): string | undefined {
    if (!value || /^(?:\/\/|\\)/.test(value)) return undefined;
    return /^(?:\/(?!\/)|#|https:\/\/)/i.test(value) ? value : undefined;
  }

  for (const remote of await loadSanityPages()) {
    if (!remote || typeof remote !== 'object' || typeof remote._id !== 'string') continue;
    const route = normalizeRoute(remote.route);
    if (!route || CODE_CONTROLLED_ROUTES.has(route)) continue;

    const fallback = byRoute.get(route);
    if (!cmsContentCanPublish(remote, fallback, { previewDrafts: process.env.SANITY_PREVIEW_DRAFTS === 'true' })) continue;
    const discovery = normalizeDiscovery(remote.discovery);
    const faqs = (remote.faqs || []).filter(
      (item): item is { question: string; answer: string } => Boolean(item.question && item.answer),
    );
    const overrides = {
      title: remote.seo?.title || remote.title,
      description: remote.seo?.description || remote.description,
      socialTitle: remote.seo?.socialTitle,
      socialDescription: remote.seo?.socialDescription,
      image: remote.seo?.imageUrl || remote.heroMedia?.url,
      author: remote.author,
      reviewer: remote.reviewer,
      publishedAt: remote.publishedAt,
      updatedAt: remote.updatedAt,
      index: remote.seo?.noIndex === undefined ? undefined : !remote.seo.noIndex,
      discovery,
    };

    if (fallback) {
      byRoute.set(route, {
        ...fallback,
        ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)),
        contentSource: remote.body?.length ? 'sanity' : 'local',
        previewDraft: remote._id.startsWith('drafts.'),
        structuredBody: remote.body?.length ? remote.body : undefined,
        faqs: faqs.length ? faqs : undefined,
        eyebrow: remote.eyebrow,
        heroMedia: remote.heroMedia?.url && remote.heroMedia.alt ? remote.heroMedia as SitePage['heroMedia'] : undefined,
        testimonials: (remote.testimonials || []).filter(
          (item): item is { quote: string; travellerName: string; travellerContext?: string; verified?: boolean } => Boolean(item.quote && item.travellerName),
        ),
        founderNote: remote.founderNote,
        cta: remote.cta?.label && safeDestination(remote.cta.destination) ? { label: remote.cta.label, destination: safeDestination(remote.cta.destination)! } : undefined,
        featuredContent: (remote.featuredContent || []).filter((item) => item.title && item.slug && normalizeRoute(`/guides/${item.slug}`)).map((item) => ({ title: item.title!, route: `/guides/${item.slug}` })),
        sourceLinks: (remote.sourceLinks || []).filter((item) => item.label && safeDestination(item.url)).map((item) => ({ label: item.label!, url: safeDestination(item.url)!, checkedAt: item.checkedAt })),
      });
      continue;
    }

    if (!remote.title || !remote.description || !remote.updatedAt || !remote.body?.length) continue;
    byRoute.set(route, {
      id: remote._id,
      route,
      legacySource: 'guides/index.html',
      pageType: remote._type === 'guide' ? 'article' : 'website',
      title: remote.seo?.title || remote.title,
      description: remote.seo?.description || remote.description,
      socialTitle: remote.seo?.socialTitle,
      socialDescription: remote.seo?.socialDescription,
      image: remote.seo?.imageUrl || remote.heroMedia?.url || '/images/hero-skyline-main.jpg',
      publishedAt: remote.publishedAt,
      updatedAt: remote.updatedAt,
      changeFrequency: remote._type === 'guide' ? 'monthly' : 'weekly',
      priority: remote._type === 'guide' ? 0.7 : 0.6,
      index: !remote.seo?.noIndex,
      author: remote.author || 'Detour founder team',
      reviewer: remote.reviewer,
      contentSource: 'sanity',
      discovery,
      previewDraft: remote._id.startsWith('drafts.'),
      structuredBody: remote.body,
      faqs: faqs.length ? faqs : undefined,
      eyebrow: remote.eyebrow,
      heroMedia: remote.heroMedia?.url && remote.heroMedia.alt ? remote.heroMedia as SitePage['heroMedia'] : undefined,
      testimonials: (remote.testimonials || []).filter(
        (item): item is { quote: string; travellerName: string; travellerContext?: string; verified?: boolean } => Boolean(item.quote && item.travellerName),
      ),
      founderNote: remote.founderNote,
      cta: remote.cta?.label && safeDestination(remote.cta.destination) ? { label: remote.cta.label, destination: safeDestination(remote.cta.destination)! } : undefined,
      featuredContent: (remote.featuredContent || []).filter((item) => item.title && item.slug && normalizeRoute(`/guides/${item.slug}`)).map((item) => ({ title: item.title!, route: `/guides/${item.slug}` })),
      sourceLinks: (remote.sourceLinks || []).filter((item) => item.label && safeDestination(item.url)).map((item) => ({ label: item.label!, url: safeDestination(item.url)!, checkedAt: item.checkedAt })),
    });
  }

  const pages = [...byRoute.values()].map((page) => ({
    ...page,
    featuredContent: page.featuredContent?.filter((item) => byRoute.has(item.route)),
  })).sort((a, b) => a.route.localeCompare(b.route));
  return process.env.SANITY_PREVIEW_DRAFTS === 'true'
    ? pages.map((page) => ({ ...page, index: false }))
    : pages;
}

let pagesPromise: Promise<SitePage[]> | undefined;
export function getSitePages(): Promise<SitePage[]> {
  if (import.meta.env.DEV) return resolveSitePages();
  return pagesPromise ??= resolveSitePages();
}
