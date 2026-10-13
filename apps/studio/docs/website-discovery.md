# Publishing into the website collections

The website resolves one content registry before generating its navigation, collections, breadcrumbs, recommendations, search and sitemap. Publishing a page therefore includes assigning its place in the website.

## Studio workflow

In a guide or landing page, open **Website organisation** and complete:

1. **Primary section:** Explore Mumbai, Plan your layover, or How Detour works.
2. **Content group:** choose a group belonging to that section. For example, a street-food article belongs to Explore → Food and culture, while food-safety advice belongs to Plan → Practical travel.
3. **Short link title:** a readable label without an SEO suffix.
4. **Primary parent path:** normally `/guides/places`, `/guides`, or `/guides/what-to-expect-on-a-detour`. A collection or the service entrance can use `/`.
5. Add verified topic tags, alternative names and a few relevant published internal paths. Separate search aliases from claims about travel timing or suitability.

New CMS pages without a valid section and group are held out of route generation. Existing CMS imports replacing local routes retain the reviewed local classification until editors supply discovery metadata. The Studio form requires this metadata when publishing edited documents.

Published CMS pages enter their assigned collection and website search automatically. Header highlights are curated separately; they do not grow with every new page. Privacy, terms, sign-in, account, search, error pages and generated place galleries remain controlled by application code.

Production uses published Sanity documents only. Draft-preview builds are `noindex`; draft documents remain outside the public search registry. Preview mode still requires the existing server-only read token configuration.

## Local content

Existing routes are mapped in `apps/marketing/src/data/content-taxonomy.json`. New local manifests can declare the same `discovery` object directly:

```json
{
  "discovery": {
    "section": "explore",
    "group": "self-guided-walks",
    "kind": "guide",
    "navigationTitle": "A walk through Mumbai",
    "parentRoute": "/guides/places",
    "tags": ["heritage"],
    "aliases": [],
    "relatedRoutes": ["/guides/fort-kala-ghoda-mumbai"],
    "searchable": true
  }
}
```

Use the stable group IDs in `src/lib/content-registry.mjs`; public labels are defined once there. Every place uses the existing region and interest keys from `place-guides.json`. Photographs are derived children of their place, appear in the sitemap and are linked beneath that place instead of duplicating ordinary search results.

The PDF cheat sheet is a public planning resource and is included in the sitemap. Its checked-in source HTML is accounted for as an authoring artifact, excluded from search and sitemap. The resource date records the last tracked resource revision, rather than claiming a new review of its practical advice.

## Validation

`node --test apps/marketing/tests/content-registry.test.mjs` checks complete route classification, gallery ownership, public/private visibility, CMS publishing rules, safe internal references and malformed CMS data.

Run `npm run studio:test` after schema changes. Before a release, run the marketing build and route/link checks and verify representative local and CMS pages. CMS references to unresolved routes are removed from discovery; circular parent relationships fail registry validation so they can be corrected before release.
