import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse, serializeOuter } from 'parse5';
import type { SitePage } from './site-pages';
import { resolveLegacyPath } from './legacy-path.mjs';

const imageDimensions: Record<string, [number, number]> = {
  'gallery-bazaar': [1024, 1024],
  'gallery-chai': [1000, 561],
  'gallery-csmt': [1024, 1024],
  'gallery-cst': [1600, 1066],
  'gallery-dharavi': [1600, 1000],
  'gallery-gateway': [1600, 1600],
  'gallery-local-train': [1000, 749],
  'gallery-sealink': [1000, 567],
  'gallery-temple': [1024, 1024],
  'hero-gateway-night': [1600, 1062],
  'hero-skyline-main': [1600, 788],
  'hero-skyline-side': [1600, 800],
};

type LegacyAttribute = { name: string; value: string };
type LegacyNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: LegacyAttribute[];
  childNodes?: LegacyNode[];
};

export type LegacyDocument = {
  retainedHead: string;
  body: string;
  theme: string | undefined;
  faqs: Array<{ question: string; answer: string }>;
};

function attr(node: LegacyNode, name: string): string | undefined {
  return node.attrs?.find((item) => item.name === name)?.value;
}

function setAttr(node: LegacyNode, name: string, value: string): void {
  node.attrs ||= [];
  const existing = node.attrs.find((item) => item.name === name);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value });
}

function hasClass(node: LegacyNode, className: string): boolean {
  return (attr(node, 'class') || '').split(/\s+/u).includes(className);
}

function findFirst(node: LegacyNode, predicate: (candidate: LegacyNode) => boolean): LegacyNode | undefined {
  if (predicate(node)) return node;
  for (const child of node.childNodes || []) {
    const match = findFirst(child, predicate);
    if (match) return match;
  }
  return undefined;
}

function cleanLocalUrl(value: string, source: string): string {
  try {
    const parsed = new URL(value, 'https://detour.local');
    if (parsed.origin !== 'https://detour.local' || value.startsWith('//') || value.startsWith('#')) return value;
  } catch {
    return value;
  }

  const [rawPath, suffix = ''] = value.split(/(?=[?#])/u, 2);
  const sourceDirectory = `/${path.posix.dirname(source)}`.replace(/\/$/u, '');
  let resolved = path.posix.normalize(path.posix.join(sourceDirectory, rawPath));
  if (!resolved.startsWith('/')) resolved = `/${resolved}`;
  if (resolved.endsWith('/index.html')) resolved = resolved.slice(0, -'/index.html'.length) || '/';
  else if (resolved.endsWith('.html')) resolved = resolved.slice(0, -'.html'.length);
  return `${resolved}${suffix}`;
}

function enhanceImage(node: LegacyNode): void {
  if (node.tagName !== 'img') return;
  const source = attr(node, 'src');
  if (!source?.startsWith('/images/') || !source.endsWith('.jpg')) return;
  const basename = source.slice('/images/'.length, -'.jpg'.length);
  const dimensions = imageDimensions[basename];
  if (!dimensions) return;

  setAttr(node, 'srcset', `/images/${basename}-480.webp 480w, /images/${basename}-768.webp 768w, /images/${basename}.webp ${dimensions[0]}w`);
  setAttr(node, 'sizes', attr(node, 'id') === 'hero-fallback' ? '100vw' : '(max-width: 720px) calc(100vw - 40px), 50vw');
  setAttr(node, 'width', String(dimensions[0]));
  setAttr(node, 'height', String(dimensions[1]));
  setAttr(node, 'decoding', 'async');
  if (attr(node, 'id') === 'hero-fallback') setAttr(node, 'fetchpriority', 'high');
  else setAttr(node, 'loading', 'lazy');
}

function shouldRetainHeadNode(node: LegacyNode): boolean {
  const tag = node.tagName;
  if (!tag) return true;
  if (tag === 'title') return false;
  if (tag === 'meta') {
    const name = attr(node, 'name')?.toLowerCase();
    return !attr(node, 'charset')
      && name !== 'viewport'
      && name !== 'description'
      && name !== 'robots'
      && !name?.startsWith('twitter:')
      && !attr(node, 'property')?.toLowerCase().startsWith('og:');
  }
  if (tag === 'link') {
    const rel = attr(node, 'rel')?.toLowerCase();
    const href = attr(node, 'href') || '';
    if (rel === 'canonical' || rel === 'icon') return false;
    if (href.startsWith('https://fonts.googleapis.com/')) return false;
    if (rel === 'preconnect' && (href === 'https://fonts.googleapis.com' || href === 'https://fonts.gstatic.com')) return false;
  }
  if (tag === 'script') {
    const source = attr(node, 'src') || '';
    if (attr(node, 'type') === 'application/ld+json') return false;
    if (source.includes('googletagmanager.com') || source.endsWith('assets/utm.js')) return false;
    if (textContent(node).includes("gtag('config'")) return false;
  }
  return true;
}

function textContent(node: LegacyNode): string {
  if (node.tagName === 'script' || node.tagName === 'style') return '';
  if (node.nodeName === '#text') return node.value || '';
  return (node.childNodes || []).map(textContent).join(' ');
}

function normalizeText(node: LegacyNode): string {
  return textContent(node).replace(/\s+/gu, ' ').trim();
}

function prepareTree(node: LegacyNode, source: string, inHead = false): void {
  if (node.attrs) {
    for (const item of node.attrs) {
      if (['href', 'src', 'poster', 'data-src'].includes(item.name)) item.value = cleanLocalUrl(item.value, source);
    }
  }
  enhanceImage(node);
  if (node.childNodes) {
    node.childNodes = node.childNodes.filter((child) => {
      if (inHead && !shouldRetainHeadNode(child)) return false;
      if (!inHead && child.tagName === 'script' && (attr(child, 'src') || '').endsWith('assets/booking.js')) return false;
      return true;
    });
    for (const child of node.childNodes) prepareTree(child, source, inHead);
  }
}

function extractFaqs(body: LegacyNode): Array<{ question: string; answer: string }> {
  const results: Array<{ question: string; answer: string }> = [];
  const visit = (node: LegacyNode): void => {
    if (node.tagName === 'div' && hasClass(node, 'faq-item')) {
      const questionNode = findFirst(node, (candidate) => candidate.tagName === 'button' && hasClass(candidate, 'faq-q'));
      const answerNode = findFirst(node, (candidate) => candidate.tagName === 'div' && hasClass(candidate, 'faq-a-inner'));
      const question = questionNode ? normalizeText(questionNode) : '';
      const answer = answerNode ? normalizeText(answerNode) : '';
      if (question && answer) results.push({ question, answer });
      return;
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(body);
  return results;
}

function serializeChildren(node: LegacyNode): string {
  return (node.childNodes || []).map((child) => serializeOuter(child as never)).join('');
}

export async function readLegacyDocument(page: SitePage): Promise<LegacyDocument> {
  const safeSource = page.legacySource.replace(/^\/+/, '');
  const source = await readFile(resolveLegacyPath(safeSource), 'utf8');
  const document = parse(source) as unknown as LegacyNode;
  const html = findFirst(document, (node) => node.tagName === 'html');
  const head = findFirst(document, (node) => node.tagName === 'head');
  const body = findFirst(document, (node) => node.tagName === 'body');
  if (!head || !body) throw new Error(`Legacy document is missing head or body: ${safeSource}`);

  prepareTree(head, safeSource, true);
  prepareTree(body, safeSource, false);
  return {
    retainedHead: serializeChildren(head).trim(),
    body: serializeChildren(body),
    theme: html ? attr(html, 'data-theme') : undefined,
    faqs: extractFaqs(body),
  };
}
