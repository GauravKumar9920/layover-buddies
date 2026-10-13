import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'parse5';
import { createContentRegistry } from '../src/lib/content-registry.mjs';

const app = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, app), 'utf8'));
const manifests = await Promise.all((await readdir(new URL('src/content/pages/', app))).filter(name => name.endsWith('.json')).map(name => readJson(`src/content/pages/${name}`)));
const items = createContentRegistry({pages: manifests, places: await readJson('src/data/place-guides.json'), taxonomy: await readJson('src/data/content-taxonomy.json')});
const routes = items.filter(item => !item.route.includes('/downloads/')).map(item => item.route);
const trees = new Map();
const attr = (node, key) => node.attrs?.find(attribute => attribute.name === key)?.value;
const all = (tree, predicate) => {
  const found = [];
  const visit = node => { if (predicate(node)) found.push(node); for (const child of node.childNodes || []) visit(child); };
  visit(tree); return found;
};
for (const route of routes) {
  const file = route === '/' ? 'dist/index.html' : route === '/404' ? 'dist/404.html' : `dist${route}/index.html`;
  trees.set(route, parse(await readFile(new URL(file, app), 'utf8')));
}

test('every HTML page has one shared header, footer and a breadcrumb away from home', () => {
  for (const [route, tree] of trees) {
    assert.equal(all(tree, node => attr(node, 'data-site-header') !== undefined).length, 1, `${route}: header`);
    assert.equal(all(tree, node => attr(node, 'data-site-footer') !== undefined).length, 1, `${route}: footer`);
    assert.equal(all(tree, node => attr(node, 'id') === 'nav').length, 0, `${route}: retired nav`);
    if (route !== '/') assert.equal(all(tree, node => attr(node, 'data-site-breadcrumbs') !== undefined).length, 1, `${route}: breadcrumb`);
  }
});

test('public pages and galleries are reachable from the homepage through real links', () => {
  const reachable = new Set(['/']);
  const queue = ['/'];
  while (queue.length) {
    const tree = trees.get(queue.shift());
    if (!tree) continue;
    for (const link of all(tree, node => node.tagName === 'a' && attr(node, 'href'))) {
      const url = new URL(attr(link, 'href'), 'https://detourtrips.com');
      const route = url.pathname.replace(/\/$/, '') || '/';
      if (url.origin !== 'https://detourtrips.com' || !trees.has(route) || reachable.has(route)) continue;
      reachable.add(route); queue.push(route);
    }
  }
  for (const item of items.filter(item => (item.searchable || item.kind === 'gallery' && item.index) && trees.has(item.route))) assert.ok(reachable.has(item.route), `${item.route} is orphaned`);
});

test('shared menu, breadcrumbs, article contents and hub shortcuts link to real anchors', () => {
  for (const [route, tree] of trees) {
    const surfaces = all(tree, node => attr(node, 'data-site-header') !== undefined || attr(node, 'data-site-breadcrumbs') !== undefined || attr(node, 'data-article-contents') !== undefined || (attr(node, 'class') || '').includes('explore-area-links'));
    for (const surface of surfaces) for (const link of all(surface, node => node.tagName === 'a' && attr(node, 'href'))) {
      const url = new URL(attr(link, 'href'), `https://detourtrips.com${route}`);
      const destination = url.pathname.replace(/\/$/, '') || '/';
      if (url.origin !== 'https://detourtrips.com' || !url.hash || !trees.has(destination)) continue;
      // The homepage inquiry anchors refer to the desktop modal or mobile planner.
      if (destination === '/' && url.hash === '#board') continue;
      const id = decodeURIComponent(url.hash.slice(1));
      assert.ok(all(trees.get(destination), node => attr(node, 'id') === id).length, `${route}: ${attr(link, 'href')} missing anchor`);
    }
  }
});

test('all indexable gallery pages enter the sitemap; private routes and authoring sources stay out', async () => {
  const sitemap = await readFile(new URL('dist/sitemap.xml', app), 'utf8');
  for (const item of items.filter(item => item.kind === 'gallery' && item.index)) assert.ok(sitemap.includes(`<loc>https://detourtrips.com${item.route}</loc>`), item.route);
  for (const route of ['/account', '/login', '/search', '/404', '/downloads/cheat-sheet-source.html']) assert.ok(!sitemap.includes(`<loc>https://detourtrips.com${route}</loc>`), route);
});
