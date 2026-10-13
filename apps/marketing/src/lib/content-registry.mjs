/** Shared discovery rules. Pure functions keep publishing and build checks testable. */
export const CONTENT_SECTIONS = ['explore', 'plan', 'detour', 'utility'];
export const SECTION_LABELS = { explore: 'Explore Mumbai', plan: 'Plan your layover', detour: 'How Detour works', utility: 'Detour' };
export const GROUP_LABELS = {
  'start-here': 'Start here', 'by-time': 'Plans by duration', 'airport-essentials': 'Airport essentials',
  'practical-travel': 'Practical travel', 'conditions-and-preparation': 'Weather and preparation',
  'pace-and-needs': 'Your pace and needs', 'self-guided-walks': 'Self-guided walks',
  'food-and-culture': 'Food and culture', 'browse-all': 'All places',
  'close-to-the-airport': 'Close to the airport', 'central-mumbai': 'Central Mumbai',
  'south-mumbai': 'South Mumbai', 'further-afield': 'Further afield', photographs: 'Photographs',
  'how-it-works': 'The experience', 'plans-changing': 'When plans change', careers: 'Careers',
  legal: 'Legal', account: 'Your account', 'site-home': 'Home', recovery: 'Page recovery',
  resources: 'Planning resources', search: 'Search',
};
export const SECTION_GROUPS = {
  explore: ['browse-all', 'self-guided-walks', 'food-and-culture', 'close-to-the-airport', 'central-mumbai', 'south-mumbai', 'further-afield', 'photographs'],
  plan: ['start-here', 'by-time', 'airport-essentials', 'practical-travel', 'conditions-and-preparation', 'pace-and-needs', 'resources'],
  detour: ['how-it-works', 'plans-changing', 'careers'],
  utility: ['site-home', 'legal', 'account', 'recovery', 'search'],
};

const SECTION_PARENTS = { explore: '/guides/places', plan: '/guides', detour: '/guides/what-to-expect-on-a-detour', utility: '/' };
const PRIVATE_ROUTES = new Set(['/login', '/account', '/404', '/search', '/downloads/cheat-sheet-source.html']);
const CODE_CONTROLLED_ROUTES = new Set(['/privacy', '/terms', '/login', '/account', '/404', '/search']);

const KNOWN_ALIASES = {
  '/guides/csmt-heritage-quarter-mumbai': ['CSMT', 'CST', 'VT', 'Victoria Terminus', 'Chhatrapati Shivaji Maharaj Terminus'],
  '/guides/mumbai-airport-luggage-storage': ['bags', 'baggage', 'left luggage', 'lockers'],
  '/guides/phone-internet-mumbai-layover': ['SIM', 'eSIM', 'mobile data', 'Wi-Fi'],
  '/guides/mumbai-airport-to-city': ['taxi', 'cab', 'Uber', 'airport transfer', 'metro'],
  '/guides/mumbai-layover-visa': ['visa', 'entry requirements', 'immigration'],
  '/guides/is-mumbai-safe-on-a-layover': ['safety', 'solo travel'],
  '/guides/eating-safely-mumbai-layover': ['food safety', 'drinking water'],
  '/guides/mumbai-street-food-layover': ['vada pav', 'pav bhaji', 'chai'],
  '/guides/monsoon-layover-mumbai': ['rain', 'weather'],
  '/guides/can-i-leave-mumbai-airport': ['layover checker', 'time outside', 'can I leave the airport'],
  '/guides/family-layover-mumbai': ['children', 'kids', 'older parents', 'slow travel'],
  '/guides/what-if-my-layover-changes': ['delayed flight', 'cancellation', 'changing plans'],
  '/guides/money-on-a-mumbai-layover': ['cash', 'rupees', 'ATM', 'currency', 'budget'],
  '/guides/short-layover-mumbai': ['five hours', 'six hours', '5 hours', '6 hours'],
  '/guides/8-hour-layover-mumbai': ['eight hours', '8 hours'],
  '/guides/12-hour-layover-mumbai': ['twelve hours', '12 hours'],
  '/guides/overnight-layover-mumbai': ['night', 'hotel', 'sleep'],
  '/guides/elephanta-caves-mumbai': ['Gharapuri', 'ferry'],
};
const CURATED_RELATED = {
  '/guides/what-to-expect-on-a-detour': ['/guides/what-if-my-layover-changes', '/guides/can-i-leave-mumbai-airport', '/guides/places'],
  '/guides/what-if-my-layover-changes': ['/guides/what-to-expect-on-a-detour', '/guides/can-i-leave-mumbai-airport'],
  '/guides/mumbai-layover-visa': ['/guides/can-i-leave-mumbai-airport', '/guides/mumbai-airport-transit-layover', '/guides/mumbai-airport-luggage-storage'],
  '/guides/mumbai-street-food-layover': ['/guides/eating-safely-mumbai-layover', '/guides/mumbai-etiquette-what-to-wear', '/guides/places'],
  '/guides/eating-safely-mumbai-layover': ['/guides/mumbai-street-food-layover', '/guides/money-on-a-mumbai-layover'],
  '/guides/fort-kala-ghoda-heritage-walk': ['/guides/fort-kala-ghoda-mumbai', '/guides/csmt-heritage-quarter-mumbai', '/guides/mumbai-airport-to-city'],
  '/guides/bandra-village-walk': ['/guides/bandra-fort-bandstand-mumbai', '/guides/carter-road-mumbai', '/guides/can-i-leave-mumbai-airport'],
};

const uniqueStrings = (values, limit = 30) => [...new Set((Array.isArray(values) ? values : [])
  .filter((value) => typeof value === 'string' && value.trim())
  .map((value) => value.trim().slice(0, 120)))].slice(0, limit);

export function normalizeContentRoute(value) {
  if (typeof value !== 'string' || !/^\/[a-z0-9/_.-]*$/i.test(value) || value.includes('//')) return undefined;
  if (value.split('/').some((part) => part === '.' || part === '..')) return undefined;
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

/** CMS cannot redefine application-owned privacy, authentication or system pages. */
export function editableCmsRoute(value) {
  const route = normalizeContentRoute(value);
  return route && !route.includes('.') && !CODE_CONTROLLED_ROUTES.has(route.toLowerCase()) && !/^\/guides\/[^/]+\/photos$/i.test(route) ? route : undefined;
}

/** Ignore malformed discovery objects; callers can retain reviewed local metadata. */
export function normalizeDiscovery(value) {
  if (!value || typeof value !== 'object' || !CONTENT_SECTIONS.includes(value.section)) return undefined;
  if (!SECTION_GROUPS[value.section].includes(value.group)) return undefined;
  const navigationTitle = typeof value.navigationTitle === 'string' ? value.navigationTitle.trim().slice(0, 100) : undefined;
  return {
    section: value.section, group: value.group,
    ...(['guide', 'hub', 'company'].includes(value.kind) ? { kind: value.kind } : {}),
    ...(navigationTitle ? { navigationTitle } : {}),
    ...(normalizeContentRoute(value.parentRoute) ? { parentRoute: normalizeContentRoute(value.parentRoute) } : {}),
    tags: uniqueStrings(value.tags), aliases: uniqueStrings(value.aliases),
    relatedRoutes: uniqueStrings(value.relatedRoutes).map(normalizeContentRoute).filter(Boolean),
    ...(typeof value.searchable === 'boolean' ? { searchable: value.searchable } : {}),
  };
}

export function cmsContentCanPublish(remote, fallback, { previewDrafts = false } = {}) {
  const route = editableCmsRoute(remote?.route);
  if (!route || (!previewDrafts && typeof remote?._id === 'string' && remote._id.startsWith('drafts.'))) return false;
  // Existing imports continue using their reviewed local classification. New content
  // must be intentionally assigned a home before it enters routes, hubs and search.
  const discovery = normalizeDiscovery(remote?.discovery);
  return Boolean(fallback || (remote?.title && remote?.description && remote?.updatedAt && Array.isArray(remote?.body) && remote.body.length && discovery && discovery.section !== 'utility'));
}

const objectValue = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const textValue = (value) => typeof value === 'string' ? value : undefined;
const validDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined;
const objectArray = (values) => (Array.isArray(values) ? values : []).filter(objectValue);

/** Sanity responses are data. Reject malformed shapes before they reach templates. */
export function normalizeCmsDocument(value) {
  if (!objectValue(value) || typeof value._id !== 'string' || !['guide', 'landingPage'].includes(value._type)) return undefined;
  const body = objectArray(value.body).filter((block) => ['block', 'image'].includes(block._type)).map((block) => ({
    _key: textValue(block._key), _type: block._type, style: textValue(block.style),
    ...(['bullet', 'number'].includes(block.listItem) ? { listItem: block.listItem } : {}),
    children: objectArray(block.children).map((span) => ({ _key: textValue(span._key), _type: textValue(span._type), text: textValue(span.text) || '', marks: uniqueStrings(span.marks) })),
    markDefs: objectArray(block.markDefs).filter((mark) => typeof mark._key === 'string' && typeof mark._type === 'string').map((mark) => ({ _key: mark._key, _type: mark._type, href: textValue(mark.href) })),
    ...(objectValue(block.asset) ? { asset: { url: textValue(block.asset.url), alt: textValue(block.asset.alt) } } : {}),
  }));
  return {
    _id: value._id, _type: value._type, route: normalizeContentRoute(value.route), slug: textValue(value.slug),
    title: textValue(value.title), description: textValue(value.description), publishedAt: validDate(value.publishedAt), updatedAt: validDate(value.updatedAt),
    author: textValue(value.author), reviewer: textValue(value.reviewer), eyebrow: textValue(value.eyebrow), founderNote: textValue(value.founderNote),
    discovery: normalizeDiscovery(value.discovery), body,
    faqs: objectArray(value.faqs).map((faq) => ({ question: textValue(faq.question), answer: textValue(faq.answer) })),
    testimonials: objectArray(value.testimonials).map((item) => ({ quote: textValue(item.quote), travellerName: textValue(item.travellerName), travellerContext: textValue(item.travellerContext), verified: item.verified === true })),
    featuredContent: objectArray(value.featuredContent).map((item) => ({ title: textValue(item.title), slug: textValue(item.slug) })),
    sourceLinks: objectArray(value.sourceLinks).map((item) => ({ label: textValue(item.label), url: textValue(item.url), checkedAt: validDate(item.checkedAt) })),
    ...(objectValue(value.heroMedia) ? { heroMedia: { url: textValue(value.heroMedia.url), alt: textValue(value.heroMedia.alt), caption: textValue(value.heroMedia.caption), credit: textValue(value.heroMedia.credit) } } : {}),
    ...(objectValue(value.cta) ? { cta: { label: textValue(value.cta.label), destination: textValue(value.cta.destination) } } : {}),
    ...(objectValue(value.seo) ? { seo: {
      title: textValue(value.seo.title), description: textValue(value.seo.description), socialTitle: textValue(value.seo.socialTitle), socialDescription: textValue(value.seo.socialDescription), imageUrl: textValue(value.seo.imageUrl),
      ...(typeof value.seo.noIndex === 'boolean' ? { noIndex: value.seo.noIndex } : {}),
    } } : {}),
  };
}

function defaultDiscovery(page) {
  if (page.route === '/') return { section: 'utility', group: 'site-home', kind: 'home', parentRoute: null, searchable: false };
  if (PRIVATE_ROUTES.has(page.route)) return { section: 'utility', group: page.route === '/search' ? 'search' : page.pageType === 'error' ? 'recovery' : 'account', kind: page.pageType === 'error' || page.route === '/search' ? 'system' : 'account', parentRoute: '/', searchable: false };
  return { section: 'plan', group: 'start-here', kind: page.pageType === 'collection' ? 'hub' : 'guide', parentRoute: '/guides', searchable: true };
}

function makeItem(page, metadata, place) {
  const discovery = normalizeDiscovery(page.discovery);
  const merged = { ...defaultDiscovery(page), ...metadata, ...(discovery || {}) };
  const kind = place ? 'place' : metadata?.kind || merged.kind;
  const isPrivate = PRIVATE_ROUTES.has(page.route) || page.previewDraft || page.id?.startsWith('drafts.');
  const parentRoute = discovery?.parentRoute || (metadata && Object.hasOwn(metadata, 'parentRoute') ? metadata.parentRoute : page.route === '/' ? null : SECTION_PARENTS[merged.section]);
  return {
    route: page.route,
    title: page.title,
    navigationTitle: discovery?.navigationTitle || metadata?.navigationTitle || place?.name || page.title.replace(/\s*[|—]\s*Detour(?: Trips)?$/, ''),
    summary: page.description || place?.lead || '',
    section: merged.section,
    group: merged.group,
    groupLabel: GROUP_LABELS[merged.group] || merged.group,
    kind,
    parentRoute,
    tags: uniqueStrings([...(place?.themes || []), ...(merged.tags || [])]),
    aliases: uniqueStrings([...(merged.aliases || []), ...(KNOWN_ALIASES[page.route] || [])]),
    ...(page.image || place?.photos?.[0]?.src ? { image: page.image || place.photos[0].src } : {}),
    ...(place?.region ? { region: place.region } : {}),
    searchable: !isPrivate && kind !== 'gallery' && merged.searchable !== false,
    index: !isPrivate && page.index !== false,
    updatedAt: page.updatedAt,
    relatedRoutes: uniqueStrings([...(merged.relatedRoutes || []), ...(CURATED_RELATED[page.route] || [])]),
    changeFrequency: page.changeFrequency || 'monthly',
    priority: page.priority ?? 0.5,
    contentSource: page.contentSource || 'local',
  };
}

/** Resolve published routes only. Place data alone never makes an unpublished leaf reachable. */
export function createContentRegistry({ pages, places = [], taxonomy = {}, includeResources = true }) {
  const placeByRoute = new Map(places.map((place) => [`/guides/${place.slug}`, place]));
  const records = pages.map((page) => makeItem(page, taxonomy[page.route], placeByRoute.get(page.route)));
  const byRoute = new Map(records.map((item) => [item.route, item]));

  for (const place of places) {
    const parent = byRoute.get(`/guides/${place.slug}`);
    if (!parent || !place.photos?.length) continue;
    const route = `${parent.route}/photos`;
    const gallery = {
      ...parent, route, title: `${place.name} photographs | Detour`, navigationTitle: `${place.name} photographs`,
      summary: `See ${place.photos.length} photographs from our field note on ${place.name}.`,
      group: 'photographs', groupLabel: GROUP_LABELS.photographs, kind: 'gallery', parentRoute: parent.route,
      searchable: false, index: parent.index, priority: 0.5, relatedRoutes: [parent.route],
    };
    byRoute.set(route, gallery);
    parent.relatedRoutes = uniqueStrings([route, ...parent.relatedRoutes]);
  }

  if (includeResources) {
    const resource = {
      route: '/downloads/mumbai-layover-cheat-sheet.pdf', title: 'Mumbai layover cheat sheet (PDF)', navigationTitle: 'Layover cheat sheet',
      summary: 'A printable Mumbai layover reference for airport essentials, timing and preparation.',
      section: 'plan', group: 'resources', groupLabel: GROUP_LABELS.resources, kind: 'resource', parentRoute: '/guides',
      tags: ['airport', 'planning', 'download', 'PDF'], aliases: ['cheat sheet', 'printable', 'download'],
      searchable: true, index: true, updatedAt: '2026-08-09', relatedRoutes: ['/guides/complete-mumbai-layover-guide', '/guides/can-i-leave-mumbai-airport'],
      changeFrequency: 'yearly', priority: 0.4, contentSource: 'local',
    };
    byRoute.set(resource.route, resource);
    byRoute.set('/downloads/cheat-sheet-source.html', {
      ...resource, route: '/downloads/cheat-sheet-source.html', title: 'Cheat sheet source (authoring artifact)',
      navigationTitle: 'Cheat sheet source', section: 'utility', group: 'recovery', groupLabel: 'Authoring artifact', kind: 'system',
      searchable: false, index: false, relatedRoutes: [],
    });
  }

  for (const item of byRoute.values()) {
    if (item.parentRoute === item.route || (item.parentRoute && !byRoute.has(item.parentRoute))) {
      const defaultParent = SECTION_PARENTS[item.section];
      item.parentRoute = defaultParent !== item.route && byRoute.has(defaultParent) ? defaultParent : (item.route === '/' ? null : '/');
    }
    const nearby = item.kind === 'place' ? [...byRoute.values()].filter((candidate) => candidate.kind === 'place' && candidate.region === item.region && candidate.route !== item.route).slice(0, 2).map((candidate) => candidate.route) : [];
    const contextual = item.kind === 'gallery' ? [item.parentRoute] : item.section === 'explore' ? ['/guides/can-i-leave-mumbai-airport', '/guides/places'] : item.section === 'plan' ? ['/guides/places', '/guides/can-i-leave-mumbai-airport', '/guides/what-to-expect-on-a-detour'] : ['/guides/what-to-expect-on-a-detour', '/guides'];
    item.relatedRoutes = uniqueStrings([...item.relatedRoutes, ...nearby, ...contextual]).filter((route) => {
      const related = byRoute.get(route);
      return route !== item.route && related && (related.searchable || (related.kind === 'gallery' && related.parentRoute === item.route));
    }).slice(0, 5);
  }

  return [...byRoute.values()].sort((a, b) => a.route.localeCompare(b.route));
}

export function validateContentRegistry(items) {
  const errors = [];
  const routes = new Set(items.map((item) => item.route));
  if (routes.size !== items.length) errors.push('Duplicate canonical routes in content registry.');
  for (const item of items) {
    if (!CONTENT_SECTIONS.includes(item.section) || !SECTION_GROUPS[item.section]?.includes(item.group)) errors.push(`${item.route}: invalid section or group.`);
    if (!item.title || !item.summary || !item.updatedAt) errors.push(`${item.route}: missing title, summary or updated date.`);
    if (item.parentRoute && !routes.has(item.parentRoute)) errors.push(`${item.route}: parent ${item.parentRoute} does not exist.`);
    if (item.parentRoute === item.route) errors.push(`${item.route}: a page cannot be its own parent.`);
    if (item.kind === 'gallery' && !items.some((parent) => parent.route === item.parentRoute && parent.kind === 'place')) errors.push(`${item.route}: gallery must belong to a place.`);
    if (PRIVATE_ROUTES.has(item.route) && (item.searchable || item.index)) errors.push(`${item.route}: private/system page exposed to discovery.`);
    for (const related of item.relatedRoutes) if (!routes.has(related)) errors.push(`${item.route}: related route ${related} does not exist.`);
    const seen = new Set([item.route]);
    let parent = item.parentRoute;
    while (parent) {
      if (seen.has(parent)) { errors.push(`${item.route}: circular parent relationship.`); break; }
      seen.add(parent);
      parent = items.find((candidate) => candidate.route === parent)?.parentRoute;
    }
  }
  return errors;
}
