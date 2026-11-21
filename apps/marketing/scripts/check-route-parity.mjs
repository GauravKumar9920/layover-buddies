import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeJsonLd } from '../src/lib/json-ld.mjs';
import { resolveLegacyPath } from '../src/lib/legacy-path.mjs';

const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = path.join(appRoot, 'dist');
const manifestRoot = path.join(appRoot, 'src/content/pages');
const expectedRoutes = [
  '/', '/careers', '/privacy', '/terms', '/guides', '/search',
  '/guides/complete-mumbai-layover-guide', '/guides/mumbai-layover-visa',
  '/guides/8-hour-layover-mumbai', '/guides/12-hour-layover-mumbai',
  '/guides/mumbai-airport-luggage-storage', '/guides/is-mumbai-safe-on-a-layover',
  '/guides/mumbai-airport-to-city', '/guides/short-layover-mumbai', '/guides/overnight-layover-mumbai',
  '/guides/mumbai-street-food-layover', '/guides/monsoon-layover-mumbai',
  '/guides/places', '/guides/gateway-of-india-mumbai', '/guides/marine-drive-mumbai',
  '/guides/csmt-heritage-quarter-mumbai', '/guides/bmc-headquarters-mumbai',
  '/guides/asiatic-library-town-hall-mumbai', '/guides/fort-kala-ghoda-mumbai',
  '/guides/bandra-worli-sea-link-mumbai',
  '/guides/juhu-beach-mumbai',
  '/guides/bandra-fort-bandstand-mumbai',
  '/guides/mount-mary-basilica-mumbai',
  '/guides/haji-ali-dargah-mumbai',
  '/guides/worli-sea-face-mumbai',
  '/guides/siddhivinayak-temple-mumbai',
  '/guides/dhobi-ghat-mumbai',
  '/guides/bhau-daji-lad-museum-mumbai',
  '/guides/colaba-causeway-mumbai',
  '/guides/csmvs-museum-mumbai',
  '/guides/girgaon-chowpatty-mumbai',
  '/guides/banganga-tank-mumbai',
  '/guides/crawford-market-mumbai',
  '/guides/oval-maidan-mumbai',
  '/guides/hanging-gardens-mumbai',
  '/guides/mani-bhavan-mumbai',
  '/guides/chor-bazaar-mumbai',
  '/guides/elephanta-caves-mumbai',
  '/guides/kanheri-caves-mumbai',
  '/guides/can-i-leave-mumbai-airport',
  '/login',
  '/account',
  '/guides/what-if-my-layover-changes',
  '/guides/mumbai-airport-transit-layover',
  '/guides/money-on-a-mumbai-layover',
  '/guides/phone-internet-mumbai-layover',
  '/guides/eating-safely-mumbai-layover',
  '/guides/mumbai-festivals-layover',
  '/guides/mumbai-etiquette-what-to-wear',
  '/guides/mumbai-souvenirs-layover',
  '/guides/family-layover-mumbai',
  '/guides/what-to-expect-on-a-detour',
  '/guides/fort-kala-ghoda-heritage-walk',
  '/guides/bandra-village-walk',
  '/guides/powai-lake-mumbai',
  '/guides/iskcon-juhu-mumbai',
  '/guides/carter-road-mumbai',
  '/guides/mahakali-caves-mumbai',
  '/guides/nehru-science-centre-mumbai',
  '/guides/global-vipassana-pagoda-mumbai',
  '/404',
].sort();
const expectedGalleryRoutes = [
  'gateway-of-india-mumbai', 'marine-drive-mumbai', 'csmt-heritage-quarter-mumbai',
  'bmc-headquarters-mumbai', 'asiatic-library-town-hall-mumbai', 'fort-kala-ghoda-mumbai',
  'bandra-worli-sea-link-mumbai',
  'juhu-beach-mumbai',
  'bandra-fort-bandstand-mumbai',
  'mount-mary-basilica-mumbai',
  'haji-ali-dargah-mumbai',
  'worli-sea-face-mumbai',
  'siddhivinayak-temple-mumbai',
  'dhobi-ghat-mumbai',
  'bhau-daji-lad-museum-mumbai',
  'colaba-causeway-mumbai',
  'csmvs-museum-mumbai',
  'girgaon-chowpatty-mumbai',
  'banganga-tank-mumbai',
  'crawford-market-mumbai',
  'oval-maidan-mumbai',
  'hanging-gardens-mumbai',
  'mani-bhavan-mumbai',
  'chor-bazaar-mumbai',
  'elephanta-caves-mumbai',
  'kanheri-caves-mumbai',
  'powai-lake-mumbai',
  'iskcon-juhu-mumbai',
  'carter-road-mumbai',
  'mahakali-caves-mumbai',
  'nehru-science-centre-mumbai',
  'global-vipassana-pagoda-mumbai',
].map((slug) => `/guides/${slug}/photos`);

const manifestFiles = (await readdir(manifestRoot)).filter((file) => file.endsWith('.json'));
const manifests = await Promise.all(manifestFiles.map(async (file) => JSON.parse(await readFile(path.join(manifestRoot, file), 'utf8'))));
assert.deepEqual(manifests.map((page) => page.route).sort(), expectedRoutes, 'clean route manifest drifted');
for (const page of manifests) await access(resolveLegacyPath(page.legacySource));
assert.throws(() => resolveLegacyPath('../package.json'), /Invalid legacy source path/, 'legacy traversal must be rejected');

const hostileJsonLd = serializeJsonLd({ text: '</script><script>alert(1)</script>\u2028\u2029' });
assert.doesNotMatch(hostileJsonLd, /<\/script>/i, 'JSON-LD must not be able to close its script element');
assert.ok(hostileJsonLd.includes('\\u003c/script>'));
assert.ok(hostileJsonLd.includes('\\u2028'));
assert.ok(hostileJsonLd.includes('\\u2029'));

const sitePagesSource = await readFile(path.join(appRoot, 'src/lib/site-pages.ts'), 'utf8');
assert.match(sitePagesSource, /CODE_CONTROLLED_ROUTES/);
assert.match(sitePagesSource, /CODE_CONTROLLED_ROUTES\.has\(route\)/);
for (const protectedRoute of ['/privacy', '/terms']) {
  assert.ok(sitePagesSource.includes(`'${protectedRoute}'`), `${protectedRoute} must remain code-controlled`);
}

function outputPath(route) {
  if (route === '/') return path.join(distRoot, 'index.html');
  if (route === '/404') return path.join(distRoot, '404.html');
  return path.join(distRoot, route.slice(1), 'index.html');
}

function canonicalFor(route) {
  return new URL(route, 'https://detourtrips.com').toString();
}

for (const page of manifests) {
  const file = outputPath(page.route);
  const html = await readFile(file, 'utf8');
  assert.equal((html.match(/<title>/g) || []).length, 1, `${page.route} must have one title`);
  assert.match(html, new RegExp(`<link rel="canonical" href="${canonicalFor(page.route).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, /<script type="application\/ld\+json">/, `${page.route} must contain generated JSON-LD`);
  assert.doesNotMatch(html, /formsubmit\.co/i, `${page.route} must not retain an inline FormSubmit handler`);
  assert.doesNotMatch(html, /googletagmanager\.com\/gtag\/js/i, `${page.route} must not load GA before consent`);
  assert.doesNotMatch(html, /\bgtag\s*\(\s*['"]config['"]/iu, `${page.route} must not configure GA before consent`);
  if (page.index) assert.match(await readFile(path.join(distRoot, 'sitemap.xml'), 'utf8'), new RegExp(`<loc>${canonicalFor(page.route).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`));
}

for (const route of expectedGalleryRoutes) {
  const html = await readFile(outputPath(route), 'utf8');
  assert.match(html, new RegExp(`<link rel="canonical" href="${canonicalFor(route).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, /class="full-photo-grid"/, `${route} must render its dedicated photo collection`);
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

const htmlFiles = (await walk(distRoot)).filter((file) => file.endsWith('.html'));
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  const routeDirectory = path.dirname(path.relative(distRoot, htmlFile));
  const references = [...html.matchAll(/\b(href|src|poster|data-src|srcset)="([^"]+)"/g)].flatMap((match) =>
    match[1] === 'srcset'
      ? match[2].split(',').map((candidate) => candidate.trim().split(/\s+/)[0])
      : [match[2]],
  );
  for (const reference of references) {
    if (!reference || /^(?:https?:|mailto:|tel:|data:|about:blank|#)/i.test(reference)) continue;
    assert.doesNotMatch(reference, /^(?:javascript:|vbscript:)/i, `unsafe URL in ${path.relative(distRoot, htmlFile)}`);
    const clean = reference.split(/[?#]/)[0];
    const relative = clean.startsWith('/') ? clean.slice(1) : path.normalize(path.join(routeDirectory, clean));
    if (!relative) continue;
    const exact = path.join(distRoot, relative);
    const extension = path.extname(relative);
    try {
      if (extension) await access(exact);
      else await access(path.join(exact, 'index.html'));
    } catch {
      throw new Error(`Broken local reference ${reference} in ${path.relative(distRoot, htmlFile)}`);
    }
  }
}

// public/assets keeps the same file names on every deploy, so each page must request
// the content-hashed URL. An unversioned script can be served from a stale cache
// against newer markup and fail before the mobile planner is wired up.
const assetHashes = new Map();
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  for (const [, reference] of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="(\/assets\/[^"]+\.(?:css|js)(?:\?[^"]*)?)"/g)) {
    const [file, query = ''] = reference.split('?');
    if (!assetHashes.has(file)) {
      assetHashes.set(file, createHash('sha256').update(await readFile(path.join(distRoot, file.slice(1)))).digest('hex').slice(0, 10));
    }
    assert.equal(query, `v=${assetHashes.get(file)}`, `${reference} in ${path.relative(distRoot, htmlFile)} must carry its content hash`);
  }
}

// Account pages are private: never indexed, never in the sitemap.
const sitemapXml = await readFile(path.join(distRoot, 'sitemap.xml'), 'utf8');
for (const route of ['/login', '/account']) {
  assert.match(await readFile(outputPath(route), 'utf8'), /<meta name="robots" content="noindex,nofollow">/, `${route} must be noindex`);
  assert.doesNotMatch(sitemapXml, new RegExp(`<loc>${canonicalFor(route)}</loc>`), `${route} must stay out of the sitemap`);
}
const checkerHtml = await readFile(outputPath('/guides/can-i-leave-mumbai-airport'), 'utf8');
assert.match(checkerHtml, /"@type":"FAQPage"/, 'layover checker must publish its visible FAQs as FAQPage');
assert.match(await readFile(outputPath('/guides/gateway-of-india-mumbai'), 'utf8'), /"@type":"TouristAttraction"/, 'place pages must describe the place as a TouristAttraction');

const homeHtml = await readFile(path.join(distRoot, 'index.html'), 'utf8');
assert.doesNotMatch(homeHtml, /fonts\.(?:googleapis|gstatic)\.com/i, 'public fonts must be self-hosted to keep first paint deterministic');
for (const font of [
  'bricolage-grotesque-latin.woff2', 'plus-jakarta-sans-latin.woff2',
  'dm-mono-latin.woff2', 'instrument-serif-italic-latin.woff2',
]) await access(path.join(distRoot, 'fonts', font));
assert.match(homeHtml, /id="hero-video"[^>]*preload="none"/i, 'hero video must not be an initial dependency');
assert.match(homeHtml, /id="band-video"[^>]*preload="none"/i, 'secondary video must be deferred');
assert.doesNotMatch(homeHtml, /<source[^>]+\ssrc="\/videos\//i, 'video sources must attach after load/intersection');
assert.match(homeHtml, /data-src="\/videos\/hero-video-lite\.mp4"/i);
assert.match(homeHtml, /data-src="\/videos\/below_hero-web\.mp4"/i);
assert.match(homeHtml, /addEventListener\('pointerdown',activateHeroVideo/);
assert.doesNotMatch(homeHtml, /requestIdleCallback/);
assert.ok((await stat(path.join(distRoot, 'videos/hero-video-lite.mp4'))).size < 1_000_000, 'interactive hero video must stay below 1 MB');

const initialLocal = new Set(['/assets/analytics.js', '/assets/utm.js', '/assets/booking.js']);
for (const match of homeHtml.matchAll(/<img\b([^>]*)>/gi)) {
  if (/loading="lazy"/i.test(match[1])) continue;
  const src = match[1].match(/\bsrc="(\/[^"?#]+)"/i)?.[1];
  if (src) initialLocal.add(src);
}
let initialBytes = 0;
for (const resource of initialLocal) initialBytes += (await stat(path.join(distRoot, resource.slice(1)))).size;
assert.ok(initialBytes < 2_000_000, `initial local payload is ${initialBytes} bytes, expected under 2 MB`);

const analytics = await readFile(path.join(distRoot, 'assets/analytics.js'), 'utf8');
for (const event of ['booking_form_open', 'form_start', 'generate_lead', 'cheat_sheet_download', 'app_store_click']) {
  assert.ok(analytics.includes(event), `missing analytics event ${event}`);
}
assert.match(analytics, /analytics_storage: consent === 'granted' \? 'granted' : 'denied'/);
assert.match(analytics, /getConsent/);
assert.match(analytics, /detour:analytics-consent/);
const allowedParameterSource = analytics.match(/var allowedParameters = \[([^\]]+)\]/)?.[1] || '';
for (const forbiddenParameter of ['name', 'email', 'flight', 'phone', 'emergency', 'interests']) {
  assert.doesNotMatch(allowedParameterSource, new RegExp(`['"]${forbiddenParameter}['"]`, 'i'), `GA parameter allowlist includes ${forbiddenParameter}`);
}
const attribution = await readFile(path.join(distRoot, 'assets/utm.js'), 'utf8');
assert.match(attribution, /FIRST_TOUCH_TTL_MS = 90 \* 24 \* 60 \* 60 \* 1000/);
assert.match(attribution, /getConsent\(\) === 'granted'/);
assert.match(attribution, /removeStore\(FIRST_KEY, window\.localStorage\)/);
assert.doesNotMatch(attribution, /gclid|fbclid|msclkid/i, 'advertising click identifiers must not be retained');
const booking = await readFile(path.join(distRoot, 'assets/booking.js'), 'utf8');
assert.match(booking, /requestType: requestType/);
assert.match(booking, /contact: \{/);
assert.match(booking, /response\.status === 202/);
assert.match(booking, /fallbackEligible === false/);
assert.match(booking, /landingPage: location\.pathname,/);
assert.doesNotMatch(booking, /location\.pathname \+ location\.search/);
assert.equal((booking.match(/track\('generate_lead'/g) || []).length, 1, 'generate_lead must have one success-only call site');
assert.ok(
  booking.indexOf('var result = await submitPrimary(payload)') < booking.indexOf("track('generate_lead'"),
  'generate_lead must run only after the primary Detour endpoint confirms the request',
);

assert.match(homeHtml, /<a\b[^>]*href="\/privacy"/i, 'privacy must remain a real no-JS internal link');
assert.match(homeHtml, /<a\b[^>]*href="\/terms"/i, 'terms must remain a real no-JS internal link');

const privacyHtml = await readFile(path.join(distRoot, 'privacy/index.html'), 'utf8');
for (const disclosure of ['Supabase', 'Resend', 'FormSubmit', '90 days', '30 days']) {
  assert.ok(privacyHtml.includes(disclosure), `privacy policy is missing ${disclosure} disclosure`);
}
assert.doesNotMatch(homeHtml, /anonymised website analytics|Once your detour is complete/i, 'homepage privacy summary is stale');

console.log(`Marketing parity checks passed for ${expectedRoutes.length + expectedGalleryRoutes.length} routes; initial local payload ${Math.round(initialBytes / 1024)} KiB.`);
