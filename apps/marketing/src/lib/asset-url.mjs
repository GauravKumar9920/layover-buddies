import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Files in public/assets keep the same name on every deploy. Without a version,
// a browser or proxy cache can pair an older script with newer markup: the
// previous mobile.js stops at an element that the shared header removed, so
// "Plan my detour" never gets its handler. Each build stamps these references
// with a hash of the file's contents, so changed markup always loads its own script.
// Workspace scripts run with apps/marketing as cwd (see legacy-path.mjs).
const publicRoot = path.resolve(process.cwd(), 'public');
const versions = new Map();

/** `/assets/x.js` → `/assets/x.js?v=<content hash>`. Other URLs are returned unchanged. */
export function assetUrl(url) {
  const file = String(url).split(/[?#]/, 1)[0];
  if (!/^\/assets\/[\w./-]+\.(?:css|js)$/.test(file) || file.includes('..')) return url;
  if (!versions.has(file)) {
    const contents = readFileSync(path.join(publicRoot, file));
    versions.set(file, createHash('sha256').update(contents).digest('hex').slice(0, 10));
  }
  return `${file}?v=${versions.get(file)}`;
}

/** Version every `/assets/*.css|js` href or src in an HTML fragment. */
export function versionAssetUrls(html) {
  return String(html).replace(/\b(href|src)="(\/assets\/[^"?#]+\.(?:css|js))"/g, (_, attribute, url) => `${attribute}="${assetUrl(url)}"`);
}
