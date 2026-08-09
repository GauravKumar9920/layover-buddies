import { readFile } from 'node:fs/promises';
import path from 'node:path';
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

export type LegacyDocument = {
  retainedHead: string;
  body: string;
  theme: string | undefined;
  faqs: Array<{ question: string; answer: string }>;
};

function stripTags(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLocalUrl(value: string, source: string): string {
  if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(value)) return value;
  const [rawPath, suffix = ''] = value.split(/(?=[?#])/u, 2);
  const sourceDirectory = `/${path.posix.dirname(source)}`.replace(/\/$/, '');
  let resolved = path.posix.normalize(path.posix.join(sourceDirectory, rawPath));
  if (!resolved.startsWith('/')) resolved = `/${resolved}`;

  if (resolved.endsWith('/index.html')) resolved = resolved.slice(0, -'/index.html'.length) || '/';
  else if (resolved.endsWith('.html')) resolved = resolved.slice(0, -'.html'.length);
  return `${resolved}${suffix}`;
}

function rewriteLocalUrls(markup: string, source: string): string {
  return markup.replace(
    /\b(href|src|poster|data-src)=(['"])([^'"]+)\2/gi,
    (full, attribute: string, quote: string, value: string) =>
      `${attribute}=${quote}${cleanLocalUrl(value, source)}${quote}`,
  );
}

function enhanceImages(markup: string): string {
  return markup.replace(/<img\b[^>]*>/gi, (tag) => {
    const source = tag.match(/\bsrc=(['"])(\/images\/([^/'"]+)\.jpg)\1/i);
    if (!source) return tag;
    const basename = source[3];
    const dimensions = imageDimensions[basename];
    if (!dimensions) return tag;

    let output = tag;
    if (!/\bsrcset=/i.test(output)) {
      output = output.replace(
        /\s*\/?>(\s*)$/,
        ` srcset="/images/${basename}-480.webp 480w, /images/${basename}-768.webp 768w, /images/${basename}.webp ${dimensions[0]}w" sizes="(max-width: 720px) calc(100vw - 40px), 50vw">$1`,
      );
    }
    if (!/\bwidth=/i.test(output)) output = output.replace(/\s*>$/, ` width="${dimensions[0]}">`);
    if (!/\bheight=/i.test(output)) output = output.replace(/\s*>$/, ` height="${dimensions[1]}">`);
    if (!/\bdecoding=/i.test(output)) output = output.replace(/\s*>$/, ' decoding="async">');
    if (!/\bloading=/i.test(output) && !/id=(['"])hero-fallback\1/i.test(output)) {
      output = output.replace(/\s*>$/, ' loading="lazy">');
    }
    if (/id=(['"])hero-fallback\1/i.test(output) && !/\bfetchpriority=/i.test(output)) {
      output = output.replace(/\s*>$/, ' fetchpriority="high">');
      output = output.replace('sizes="(max-width: 720px) calc(100vw - 40px), 50vw"', 'sizes="100vw"');
    }
    return output;
  });
}

function cleanHead(head: string, source: string): string {
  return rewriteLocalUrls(head, source)
    .replace(/<meta\b[^>]*(?:charset=(['"])?[^\s>]+\1?|name=(['"])viewport\2)[^>]*>/gi, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name=(['"])(?:description|robots|twitter:[^'"]+)\1|property=(['"])og:[^'"]+\2)[^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=(['"])(?:canonical|icon)\1[^>]*>/gi, '')
    .replace(/<script\b[^>]*type=(['"])application\/ld\+json\1[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*src=(['"])[^'"]*googletagmanager\.com[^'"]*\1[^>]*><\/script>/gi, '')
    .replace(/<script\b[^>]*src=(['"])[^'"]*assets\/utm\.js\1[^>]*><\/script>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?gtag\('config'[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*rel=(['"])preconnect\1[^>]*href=(['"])https:\/\/fonts\.(?:googleapis|gstatic)\.com\/?\2[^>]*>/gi, '')
    .replace(/<link\b[^>]*href=(['"])https:\/\/fonts\.googleapis\.com\/[^'"]+\1[^>]*>/gi, '')
    .trim();
}

function extractFaqs(body: string): Array<{ question: string; answer: string }> {
  const faqs: Array<{ question: string; answer: string }> = [];
  const pattern = /<div class="faq-item">[\s\S]*?<button class="faq-q"[^>]*>([\s\S]*?)<span class="faq-ico">[\s\S]*?<div class="faq-a"><div class="faq-a-inner">([\s\S]*?)<\/div><\/div>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    const question = stripTags(match[1]);
    const answer = stripTags(match[2]);
    if (question && answer) faqs.push({ question, answer });
  }
  return faqs;
}

export async function readLegacyDocument(page: SitePage): Promise<LegacyDocument> {
  const safeSource = page.legacySource.replace(/^\/+/, '');
  const fullPath = resolveLegacyPath(safeSource);

  const source = await readFile(fullPath, 'utf8');
  const head = source.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
  const htmlAttributes = source.match(/<html\b([^>]*)>/i)?.[1] || '';
  const theme = htmlAttributes.match(/data-theme=(['"])([^'"]+)\1/i)?.[2];
  const rewrittenBody = enhanceImages(
    rewriteLocalUrls(body, safeSource).replace(
      /<script\b[^>]*src=(['"])[^'"]*assets\/booking\.js\1[^>]*><\/script>/gi,
      '',
    ),
  );

  return {
    retainedHead: cleanHead(head, safeSource),
    body: rewrittenBody,
    theme,
    faqs: extractFaqs(rewrittenBody),
  };
}
