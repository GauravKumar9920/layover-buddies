import test from 'node:test';
import assert from 'node:assert/strict';
import { articleHtmlWithNavigation } from '../src/lib/article-navigation.mjs';

test('article navigation preserves anchors and assigns unique stable links to repeated headings', () => {
  const html = articleHtmlWithNavigation('<h2 id="arrival">Arrival &amp; entry</h2><p>Welcome.</p><h2>What next?</h2><h2>What next?</h2>');
  assert.match(html, /href="#arrival"/);
  assert.match(html, /href="#section-what-next"/);
  assert.match(html, /href="#section-what-next-2"/);
  assert.match(html, /id="section-what-next-2"/);
  assert.match(html, /Arrival &amp; entry/);
  assert.match(html, /<p>Welcome\.<\/p>/);
});

test('short articles do not gain an unnecessary contents control', () => {
  assert.doesNotMatch(articleHtmlWithNavigation('<h2>One section</h2><p>Hello.</p>'), /data-article-contents/);
});

test('section labels are text and cannot introduce markup into contents links', () => {
  const html = articleHtmlWithNavigation('<h2>&lt;img onerror=alert(1)&gt;</h2><h2>Safe section</h2>');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img onerror=alert\(1\)&gt;/);
});
