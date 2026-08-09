import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../schemaTypes/index.ts', import.meta.url), 'utf8');
for (const schema of ['seo', 'faq', 'testimonial', 'sourceLink', 'media', 'guide', 'landingPage']) {
  assert.match(index, new RegExp(`\\b${schema}\\b`), `schema index is missing ${schema}`);
}

const guide = await readFile(new URL('../schemaTypes/documents/guide.ts', import.meta.url), 'utf8');
const landing = await readFile(new URL('../schemaTypes/documents/landingPage.ts', import.meta.url), 'utf8');
for (const required of ['body', 'faqs', 'testimonials', 'seo', 'heroMedia', 'updatedAt']) {
  assert.ok(guide.includes(`name: '${required}'`), `guide is missing ${required}`);
  assert.ok(landing.includes(`name: '${required}'`), `landing page is missing ${required}`);
}
assert.doesNotMatch(index + guide + landing, /service[_-]?role|deploy[_-]?hook[_-]?url/i, 'browser workspace must not contain privileged runtime secrets');
assert.match(landing, /CODE_CONTROLLED_PATHS/);
assert.match(landing, /['"]\/privacy['"]/);
assert.match(landing, /['"]\/terms['"]/);
assert.match(landing, /\.custom\(isEditablePath\)/);
console.log('Sanity schema contract checks passed.');
