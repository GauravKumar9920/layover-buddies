import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createContentRegistry, validateContentRegistry, normalizeContentRoute, normalizeDiscovery, editableCmsRoute, cmsContentCanPublish, normalizeCmsDocument } from '../src/lib/content-registry.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const taxonomy = await json('../src/data/content-taxonomy.json');
const places = await json('../src/data/place-guides.json');
const files = await readdir(new URL('../src/content/pages/', import.meta.url));
const pages = await Promise.all(files.filter((file) => file.endsWith('.json')).map(async (file) => ({ ...(await json(`../src/content/pages/${file}`)), id: file, contentSource: 'local' })));
const content = createContentRegistry({ pages, places, taxonomy });
const byRoute = new Map(content.map((item) => [item.route, item]));

test('all existing application routes and public download artifacts have a primary home', () => {
  const originalRoutes = Object.keys(taxonomy).filter((route) => route !== '/search');
  assert.equal(originalRoutes.length, 97);
  assert.equal(content.length, pages.length + places.length + 2);
  assert.equal(places.length, 32);
  for (const route of originalRoutes) assert.ok(byRoute.has(route), `missing ${route}`);
  assert.deepEqual(validateContentRegistry(content), []);
  assert.equal(byRoute.get('/guides/mumbai-street-food-layover').section, 'explore');
  assert.equal(byRoute.get('/guides/eating-safely-mumbai-layover').section, 'plan');
  assert.equal(byRoute.get('/guides/what-if-my-layover-changes').section, 'detour');
  assert.equal(byRoute.get('/guides/bandra-village-walk').group, 'self-guided-walks');
});

test('galleries stay discoverable beneath a published place and agree with sitemap policy', () => {
  for (const place of places) {
    const parent = byRoute.get(`/guides/${place.slug}`);
    const gallery = byRoute.get(`${parent.route}/photos`);
    assert.equal(gallery.parentRoute, parent.route);
    assert.equal(gallery.searchable, false);
    assert.equal(gallery.index, parent.index);
    assert.ok(parent.relatedRoutes.includes(gallery.route));
    assert.ok(gallery.relatedRoutes.includes(parent.route));
  }
  const unpublished = createContentRegistry({ pages: pages.filter((page) => page.route !== '/guides/marine-drive-mumbai'), places, taxonomy });
  assert.ok(!unpublished.some((item) => item.route === '/guides/marine-drive-mumbai/photos'));
  assert.ok(!unpublished.some((item) => item.relatedRoutes.includes('/guides/marine-drive-mumbai')));
});

test('public search and sitemap exclude private pages and authoring artifacts', () => {
  for (const route of ['/login', '/account', '/404', '/downloads/cheat-sheet-source.html']) {
    assert.equal(byRoute.get(route).searchable, false, route);
    assert.equal(byRoute.get(route).index, false, route);
  }
  const resource = byRoute.get('/downloads/mumbai-layover-cheat-sheet.pdf');
  assert.equal(resource.section, 'plan');
  assert.equal(resource.kind, 'resource');
  assert.equal(resource.searchable, true);
  assert.equal(resource.index, true);
  const indexed = content.filter((item) => item.index).map((item) => item.route);
  assert.equal(indexed.length, 95);
  assert.equal(indexed.filter((route) => route.endsWith('/photos')).length, 32);
  const forced = createContentRegistry({ pages: [{ ...pages.find((page) => page.route === '/account'), index: true, discovery: { section: 'utility', group: 'account', searchable: true } }], taxonomy, includeResources: false });
  assert.equal(forced[0].searchable, false);
  assert.equal(forced[0].index, false);
});

test('new CMS content automatically enters its collection, using validated discovery metadata', () => {
  const remote = {
    _id: 'new-guide', route: '/guides/new-heritage-walk', title: 'New heritage walk', description: 'A published walk.',
    updatedAt: '2026-10-12', body: [{ _type: 'block' }],
    discovery: { section: 'explore', group: 'self-guided-walks', navigationTitle: 'Heritage walk', tags: ['heritage'], aliases: ['old town'], parentRoute: '/guides/places', relatedRoutes: ['/guides/marine-drive-mumbai', '/not-published', 'https://example.com'] },
  };
  assert.equal(cmsContentCanPublish(remote), true);
  const resolved = createContentRegistry({ pages: [...pages, { ...remote, id: remote._id, pageType: 'article', contentSource: 'sanity' }], places, taxonomy });
  const item = resolved.find((page) => page.route === remote.route);
  assert.equal(item.section, 'explore');
  assert.equal(item.group, 'self-guided-walks');
  assert.equal(item.navigationTitle, 'Heritage walk');
  assert.equal(item.parentRoute, '/guides/places');
  assert.equal(item.searchable, true);
  assert.ok(item.relatedRoutes.includes('/guides/marine-drive-mumbai'));
  assert.ok(!item.relatedRoutes.includes('/not-published'));
  assert.deepEqual(validateContentRegistry(resolved), []);
  assert.equal(cmsContentCanPublish({ ...remote, discovery: undefined }), false);
  assert.equal(cmsContentCanPublish({ ...remote, discovery: { section: 'plan', group: 'self-guided-walks' } }), false);
  assert.equal(cmsContentCanPublish({ ...remote, discovery: undefined }, pages[0]), true, 'reviewed local imports retain their classification');
});

test('CMS route guards preserve legal/auth/system pages and block draft discovery', () => {
  for (const route of ['/privacy', '/privacy/', '/terms', '/TERMS', '/account', '/login', '/search', '/404', '/guides/marine-drive-mumbai/photos']) assert.equal(editableCmsRoute(route), undefined, route);
  const draft = { _id: 'drafts.new-guide', route: '/guides/new-guide', title: 'Draft', description: 'Private preview', updatedAt: '2026-10-12', body: [{}], discovery: { section: 'plan', group: 'by-time' } };
  assert.equal(cmsContentCanPublish(draft), false);
  assert.equal(cmsContentCanPublish(draft, undefined, { previewDrafts: true }), true);
  const preview = createContentRegistry({ pages: [...pages, { ...draft, id: draft._id, pageType: 'article', index: false }], places, taxonomy });
  const item = preview.find((page) => page.route === draft.route);
  assert.equal(item.searchable, false);
  assert.equal(item.index, false);
});

test('only canonical internal references enter breadcrumbs and recommendations', () => {
  for (const value of ['https://example.com', '//example.com', '/guides/../terms', '/guides//known', '/guides/known#part', '/guides/known?private=1', '\\terms']) assert.equal(normalizeContentRoute(value), undefined, value);
  assert.equal(normalizeContentRoute('/guides/known/'), '/guides/known');
  assert.deepEqual(normalizeDiscovery({ section: 'plan', group: 'by-time', aliases: ['8 hours', '8 hours', 8], relatedRoutes: ['/guides', '//external', '/guides/../terms'] }).relatedRoutes, ['/guides']);
  const withBadParent = createContentRegistry({ pages: [...pages, { route: '/guides/new-guide', title: 'Guide', description: 'Summary', updatedAt: '2026-10-12', discovery: { section: 'explore', group: 'food-and-culture', parentRoute: '/missing' } }], places, taxonomy });
  assert.equal(withBadParent.find((item) => item.route === '/guides/new-guide').parentRoute, '/guides/places');
  assert.deepEqual(validateContentRegistry(withBadParent), []);
});

test('the validator catches circular ownership and orphan galleries', () => {
  const a = { ...byRoute.get('/guides/8-hour-layover-mumbai'), route: '/a', parentRoute: '/b', relatedRoutes: [] };
  const b = { ...a, route: '/b', parentRoute: '/a' };
  assert.ok(validateContentRegistry([a, b]).some((error) => error.includes('circular')));
  assert.ok(validateContentRegistry([{ ...a, kind: 'gallery', parentRoute: null }]).some((error) => error.includes('gallery must belong')));
});

test('malformed CMS response fields cannot break structured rendering or publish an incomplete page', () => {
  assert.equal(normalizeCmsDocument(null), undefined);
  assert.equal(normalizeCmsDocument({ _id: 'page', _type: 'unexpected' }), undefined);
  const remote = normalizeCmsDocument({ _id: 'page', _type: 'guide', route: '/guides/test', title: 123, description: 'Description', updatedAt: 'invalid date', faqs: {}, featuredContent: [null, { title: ['unsafe'], slug: 'test' }], body: [null, { _type: 'block', children: [null, { text: 123, marks: {} }] }] });
  assert.equal(remote.title, undefined);
  assert.equal(remote.updatedAt, undefined);
  assert.deepEqual(remote.faqs, []);
  assert.equal(remote.body[0].children[0].text, '');
  assert.deepEqual(remote.body[0].children[0].marks, []);
  assert.equal(cmsContentCanPublish(remote), false);
});
