import type { APIRoute } from 'astro';
import { getSitePages } from '../lib/site-pages';

export const prerender = true;

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[character] || character);
}

export const GET: APIRoute = async ({ site }) => {
  const origin = site || new URL('https://detourtrips.com');
  const pages = (await getSitePages()).filter((page) => page.index && page.route !== '/404');
  const urls = pages.map((page) => `  <url>
    <loc>${escapeXml(new URL(page.route, origin).toString())}</loc>
    <lastmod>${escapeXml(page.updatedAt.slice(0, 10))}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`).join('\n');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
