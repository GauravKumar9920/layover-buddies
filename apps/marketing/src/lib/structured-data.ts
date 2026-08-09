import type { SitePage } from './site-pages';

const SITE_URL = 'https://detourtrips.com';

function absolute(value: string): string {
  return new URL(value, SITE_URL).toString();
}

export function buildStructuredData(
  page: SitePage,
  faqs: Array<{ question: string; answer: string }> = [],
): Record<string, unknown> {
  const canonical = absolute(page.route);
  const organization = {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Detour',
    url: SITE_URL,
    email: 'admin@detourtrips.com',
    logo: absolute('/images/hero-skyline-main.jpg'),
    sameAs: ['https://www.instagram.com/detour_trips/'],
    areaServed: { '@type': 'City', name: 'Mumbai' },
  };

  const primary =
    page.pageType === 'article'
      ? {
          '@type': 'Article',
          '@id': `${canonical}#article`,
          headline: page.title.replace(/ \| Detour$/, ''),
          description: page.description,
          image: absolute(page.image),
          datePublished: page.publishedAt || page.updatedAt,
          dateModified: page.updatedAt,
          author: { '@type': 'Organization', name: page.author, url: SITE_URL },
          ...(page.reviewer ? { reviewedBy: { '@type': 'Organization', name: page.reviewer } } : {}),
          publisher: { '@id': `${SITE_URL}/#organization` },
          mainEntityOfPage: canonical,
        }
      : page.pageType === 'collection'
        ? {
            '@type': 'CollectionPage',
            '@id': `${canonical}#page`,
            name: page.title,
            description: page.description,
            url: canonical,
          }
        : {
            '@type': page.pageType === 'home' ? 'WebSite' : 'WebPage',
            '@id': `${canonical}#page`,
            name: page.title,
            description: page.description,
            url: canonical,
          };

  const graph: Array<Record<string, unknown>> = [organization, primary];
  if (page.route.startsWith('/guides')) {
    const items = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Mumbai Layover Guides', item: `${SITE_URL}/guides` },
    ];
    if (page.route !== '/guides') {
      items.push({ '@type': 'ListItem', position: 3, name: page.title, item: canonical });
    }
    graph.push({ '@type': 'BreadcrumbList', itemListElement: items });
  }
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
