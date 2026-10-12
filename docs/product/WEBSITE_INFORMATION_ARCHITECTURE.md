# Detour website information architecture

**Status:** Implemented in the local checkout on 13 October 2026. The shared navigation and content system covers the full source library; deployment remains a separate step. The live audit below is the original 12 October snapshot.

**Reviewed:** 12 October 2026; implementation verified 13 October 2026, Mumbai time.

**Scope:** All visitor-facing content on detourtrips.com, including local and CMS pages, photographs, downloads, enquiry journeys and conditional account utilities. The traveler app and Admin console have their own information architecture; Studio content metadata is included where it determines website discovery.

## Problem and outcome

Visitors currently encounter different navigation on the homepage, editorial guides, place pages, galleries and mobile layouts. Planning advice, city exploration and explanations of Detour are mixed together, so visitors have to infer where a page belongs and often pass through a broad index to find a specific answer.

The intended outcome is one understandable content system. Every visitor-facing item has a primary home, relevant alternative discovery paths and a clear next step. A person arriving directly on a guide from Google should understand the website just as readily as someone starting on the homepage.

## Evidence and complete inventory

The checkout defines 97 application HTML routes. [The content map](website-content-map.csv) assigns every route a primary section, subgroup, parent and discovery surfaces. These are route definitions, rather than a claim that all routes are live or indexed.

| Content kind | Routes | Treatment |
| --- | ---: | --- |
| Place field notes | 32 | Explore Mumbai; area as primary grouping, interests as secondary tags |
| Place photo galleries | 32 | Children of their corresponding place; contextual media discovery |
| Editorial guides | 23 | Classified by visitor intent across Explore, Plan and How Detour works |
| Layover checker | 1 | Planning tool, with a prominent shortcut |
| Collection hubs | 2 | Explore Mumbai and Plan your layover |
| Homepage | 1 | Introduce the offer and provide the three entrances |
| Careers | 1 | Company content, reachable through the footer/service family |
| Privacy and terms | 2 | Persistent footer and relevant form/account links |
| Sign-in and account | 2 | Conditional utility navigation and authenticated continuation |
| Error page | 1 | Recovery to the content entrances and enquiry/help |
| **Total** | **97** | **Every application route classified** |

Additional public content includes `/downloads/mumbai-layover-cheat-sheet.pdf` and its source HTML at `/downloads/cheat-sheet-source.html`. The PDF belongs with planning resources. The source HTML is an authoring artifact; it needs an explicit publication/indexing decision rather than accidental exposure as another visitor page. Robots and sitemap are discovery infrastructure. Images, video and fonts are assets, not additional top-level content categories.

[The live route audit](website-live-route-status-2026-10-12.csv) records an HTTP GET for all 97 application routes and both downloads. At that snapshot, 26 content routes and the explicit `/404` route returned HTTP 200; 70 candidates returned HTTP 404. Both download URLs returned 200. Production therefore has a smaller library than the checkout. An HTTP response does not prove search-engine indexing, content approval or enabled account functionality.

Source findings that affect this plan:

- The local place library already has 32 places, seven interest filters and four area groups: eight close to the airport, six central, fifteen in South Mumbai and three further afield. Existing `?theme=` shortcuts and geographic section anchors can be reused.
- All 23 local editorial guides appear in the current guides hub. Its difficulty is presentation and navigation, rather than missing local cards. Some introductory counts/descriptions still refer to six practical guides and seven places.
- Header/footer content is repeated across legacy HTML, FieldNav, StructuredPage and MobileShell. There is a navigation breakpoint gap between the editorial desktop header and mobile shell at 768–860px.
- Local manifests and Sanity guides have page/SEO fields but no common primary section, topic taxonomy or discovery metadata. CMS additions can become routeable without entering an organised hub.
- Gallery pages currently declare `index: true`, while the sitemap emits only `getSitePages()` routes. Sitemap policy and the gallery route registry need to agree.
- Desktop and mobile use different homepage anchors and enquiry entry points. A shared menu must resolve actions to visible content on the current layout.

## Three entrances, with utilities kept accessible

Use these same labels and ordering throughout the website:

**Explore Mumbai ▾ · Plan your layover ▾ · How Detour works ▾**

**Search · My places · Sign in/My account when enabled · Plan a Detour** are utility/actions. Their desktop and mobile placement may differ; their names, availability and behavior should remain consistent.

The menu is a short set of useful shortcuts. Hubs and search provide exhaustive discovery; the menu does not need an item for every route.

| Entrance | Main groupings | Representative existing content |
| --- | --- | --- |
| Explore Mumbai | All places; by area; by interest; walks; food and culture | Marine Drive, Juhu, Fort, museums, markets, waterfronts; Fort/Kala Ghoda and Bandra walks; street food, festivals, souvenirs |
| Plan your layover | Start/check your time; plans by duration; airport essentials; practical travel; pace and needs | Checker, complete guide, short/8-hour/12-hour/overnight plans, staying airside; visa, luggage, airport transport; money, internet, monsoon, etiquette, eating safely, family/slower pace |
| How Detour works | The experience; hosts and approach; plans changing; questions; contact | What to expect on a Detour, how requests become agreed plans, founder introduction, safety approach, changes to flights/plans, FAQ and email contact |

Careers sits in the company/footer group. Privacy, terms, analytics preferences and photo credits remain accessible through the footer and relevant context. The homepage is the introduction to all three entrances, rather than another competing content category.

The existing `/guides/places` route serves Explore and `/guides` serves Plan. The existing `/guides/what-to-expect-on-a-detour` article can serve as the initial service entrance. A separate About/Help hub is unnecessary until there is enough distinct content to justify it. Menu links to hosts, safety or FAQ can resolve to existing visible sections; do not invent empty destination pages.

## Content ownership and overlap

Assign one primary home and allow multiple useful topic tags and contextual links. A primary home determines breadcrumb, hub placement and editorial ownership; it does not restrict where an item can be recommended.

| Item | Primary home | Useful alternative discovery |
| --- | --- | --- |
| Street food guide | Explore → Food and culture | Plan → Food preparation; links to eating safely |
| Eating safely | Plan → Practical travel | Street food article and food-related recommendations |
| Monsoon guide | Plan → Conditions and preparation | Explore → Good in the rain |
| Festivals | Explore → Food and culture | Planning guidance for relevant dates/traffic |
| What if my layover changes? | How Detour works → Plans changing | Time plans, checker, enquiry review and FAQ |
| Family/slower pace | Plan → Pace and needs | Suitable place recommendations and enquiry preferences |
| Place photographs | Their place page | Media results under that place and its photo link |
| Mumbai safety advice | Plan → Practical travel | Detour safety approach and relevant FAQ answers |

Differentiate “Check my layover time” from “Visa and entry requirements.” The existing question “Can I leave the airport?” sometimes labels the checker and sometimes the visa article. Labels must make the destination clear.

Use one controlled area vocabulary and one controlled interest vocabulary. Region and interest are complementary facets, not nested submenus that visitors must traverse in order. Duration plans refer to total layover length; place-fit filters refer to time outside the airport. Keep that distinction visible.

## How the structure appears throughout the site

### Homepage

Introduce the founder-hosted offer, then offer direct paths to explore places, check/plan time, and understand the experience. Retain the image-led presentation and a curated handful of places. The complete library remains accessible through a clear collection link.

Sample Detour moods are examples of possible experiences; walking guides and place field notes are published content. Present them with clear labels so a sample route does not look like a confirmed package. Planning, costs, safety, preparation and FAQ sections link into their canonical detailed content rather than creating competing explanations that drift.

### Grouped navigation and footer

Desktop uses click/keyboard-operable grouped disclosures, with a few named destinations plus category shortcuts and a visible “Browse all” link. Avoid cascading hover-only menus. Mobile uses the same hierarchy in expandable groups inside the navigation sheet. Tablet widths receive a complete navigation mode without the current breakpoint gap.

The footer offers the same three content families, company/contact links and legal/preferences/credits. It can show broader coverage than the header but uses the same taxonomy. It should remain useful on mobile and article/gallery pages.

### Explore hub

Use image-led cards with human place names, area, suggested visiting time and a clear field-note action. Provide all places, seven existing interests, geographic groups, the existing time-outside filter and map. Category menu links land on a prefiltered collection or a geographic section; they do not require an intermediate category page.

Keep walks, food/culture articles and place field notes visually distinguishable within Explore. Add a compact place-name search or shared search filtered to Explore. A result with no matches offers a way to clear the filter or broaden the search.

Keep collection/filter choices shareable where supported. Existing `?theme=` and `?outside=` are implemented; a `region=` filter would be new work. Use existing `#region-*` anchors for geographic shortcuts unless a deliberate region-filter implementation is added.

### Plan hub

Lead with the checker and complete guide, then offer jump links to time plans, airport essentials, practical travel and pace/needs. Use compact question-led cards. A visitor should not have to scan all editorial cards to find luggage, visa or an overnight plan.

Provide all relevant planning articles and the cheat-sheet resource. Cross-link to Explore and How Detour works at the point where each becomes useful. Search and a content-type filter can still retrieve articles whose primary home is elsewhere; do not force all written guides into Plan merely because their URLs begin `/guides/`.

### Articles, places and galleries

Every leaf page gets the shared header/footer and a breadcrumb derived from its primary home. Long articles get a table of contents with section anchors. A place page links to its gallery and nearby/relevant places; a gallery returns directly to its place.

Add a short next-step block based on the page's intent. For example: visa → checker/time planning; time plan → suitable places; street food → eating safely; place → shortlist/request; service explanation → enquiry. Use a few relevant recommendations, not an undifferentiated list of all pages.

Maintain image credits, alt text, source links and reviewed dates with their content. Gallery discovery should be grouped under its parent in search rather than flooding ordinary results with a second entry for every place.

### Search

Search across public, published pages and resources. Include readable titles, descriptions, aliases and controlled topics; body headings can help longer guides. Support terms such as CSMT/VT, bags/luggage and phone/SIM/internet through verified aliases.

Distinguish places, walks, practical guides, time plans, service answers and downloads in results. Group media beneath its place. Offer a useful empty state with links to the two main hubs. Account contents, drafts and other private/system content stay outside public search.

Search supplements a browsable website. Hubs and ordinary links remain accessible when JavaScript is unavailable; a search fallback can link to those hubs. Build the index from the resolved release content, including CMS additions, rather than only a hand-maintained list.

### Requests, saved places and accounts

Keep a dependable “Plan a Detour” action on every content page. It must open the intended enquiry flow on the current viewport; a link to a hidden desktop or mobile section is insufficient. Carry selected place/shortlist context into the request and preserve an understandable return to browsing.

Support the existing guest enquiry path. Show sign-in/account controls according to actual feature enablement and authentication state. Do not imply that guest tab storage has the same persistence or cross-device behavior as an authenticated account.

Include validation, empty shortlist, request review, success/error, account-disabled and signed-out states in the navigation review. Request submission continues to mean an enquiry awaiting feasibility/availability/cost agreement, not automatic booking confirmation.

### Other content and recovery

The FAQ belongs to the service family, with answers linking to canonical detail pages. Contact uses the existing email destination initially. Careers retains its listing, job detail and application journey within company content. Legal links are available wherever a form or account flow requires them.

The 404 page offers Explore, Plan, service help and a way home. The PDF has a named resource entry under Plan plus the existing capture journey; preserve the delivery flow unless a separate decision changes it. Review the public source HTML separately from the visitor resource.

## Content model and keeping it organised

Create one resolved content registry consumed by header/footer configuration, hubs, breadcrumbs, related links, search and sitemap coverage. The registry combines local pages, place metadata, derived galleries, approved downloads and Sanity pages. It does not have to store every item in one physical source file.

| Metadata | Purpose |
| --- | --- |
| Stable ID and canonical route | Resolve references without relying on display labels |
| Navigation title and short summary | Readable cards, links and search results |
| Content kind | Distinguish a place, guide, walk, tool, collection, gallery, resource or service answer |
| Primary section and subgroup | Consistent parent/hub ownership |
| Parent/reference | Gallery → place; article → collection; resource → planning |
| Topic tags and existing region/themes | Browse and recommend through more than one relevant path |
| Verified aliases | Find known places and common equivalent questions |
| Related references | Specific, editorially useful next steps |
| Discovery/publication visibility | Distinguish published public content, utilities, system pages and drafts |
| Reviewed date, author and sources | Keep practical advice and shared excerpts consistent |
| Feature availability | Avoid exposing account actions or destination links that the release cannot serve |

For this migration, assign the metadata to existing content before reshaping discovery. Add equivalent fields to the local schema and Studio documents, load them into `getSitePages()`, and merge place/gallery/resource metadata. Newly published content should enter its correct hub/search automatically. Header highlights remain deliberately curated, independently of comprehensive hub membership.

When a category changes name, use a stable category ID and update the public label once. An article can appear through several tags, while retaining one primary parent. Validate references and publication visibility in the final resolved build, including CMS-added pages.

The Studio guide and landing-page author defaults currently say “Detour Mumbai student team.” Align these defaults with the founder-hosted launch during this work. Repeated offer, costs, request and safety summaries should reference approved shared content or a common review checklist so desktop, mobile, articles and downloads agree.

## Requirements and acceptance criteria

### Must have for the complete reorganisation

- All 97 application route definitions and both public download artifacts are accounted for. Every public content item has a primary home; galleries have a valid place parent. System/utility entries have an explicit discovery policy.
- Every rendered page family exposes the same primary navigation, footer hierarchy, relevant utilities and working enquiry action. Verify legacy, CMS, place, gallery, tool, account, careers, legal and error templates.
- Every released place/article appears in its primary hub and public search index. Gallery/media discovery is grouped with the parent; downloaded resources have a named planning entry. Private/draft/account data never becomes a public search result.
- Every primary content leaf is reachable from another content page through its hub in at most two page navigations. A nested gallery can take one additional navigation and returns to its place in one. These count page navigations, not clicks/taps, form steps or mandatory intermediate category pages.
- Highlighted places and commonly needed practical answers have direct menu shortcuts. Complete content coverage belongs to hubs/search rather than an ever-growing menu.
- Every long article has useful section shortcuts; every article/place/gallery has a primary parent and relevant next step. No published primary leaf is an orphan in the release graph.
- All emitted internal routes, anchors and filtered links resolve against the actual release. Source-defined but unreleased destinations cannot be presented as available production content.
- Desktop click and keyboard, mobile touch, Escape/close focus return and visible focus work. Navigation has no hover dependency. Check 320, 390, 767, 768, 820, 860, 1024 and 1440px, plus zoom/text expansion and reduced motion.
- Core hub links remain usable without JavaScript. Filters/search have clear empty states, and account/enquiry availability is represented accurately.
- Existing canonical paths remain unless a specific content reason requires changing one. Use human breadcrumbs to communicate hierarchy without a wholesale URL migration.
- Sitemap output and indexing intent agree for manifest, CMS and derived gallery routes. A green route-parity check alone does not establish that content is discoverable.

### Useful refinements after the structure is working

- Tune search aliases/results from observed failed queries.
- Add curated area/theme landing pages only where they contain useful editorial context beyond filtered cards.
- Improve recommendations using verified content metadata and timing rules; do not invent travel feasibility from card duration alone.
- Add richer host/story content when the material is real and available.

## User journeys to verify

| Starting situation | Expected journey |
| --- | --- |
| “I heard about Marine Drive” | Any page → Explore menu → Marine Drive; no mandatory library visit |
| “I have eight hours between flights” | Any page → Plan → checker or eight-hour guide → suitable places → enquiry |
| Google arrival on visa advice | Visa article → recognise Plan hierarchy → checker/time plan → Explore/request |
| “I like heritage but have not chosen a place” | Explore menu → heritage collection → field note → photographs → parent |
| “Will this work with my parents?” | Plan → family/slower-pace guide → suitable places → enquiry preferences |
| “I cannot leave the airport” | Checker → airside guidance and airport resources; an appropriate next step |
| “What am I actually requesting?” | How Detour works → what to expect/FAQ → enquiry review with clear status |
| “I saved two places earlier” | My places → shortlist → request, with accurate guest/account continuity |
| Gallery arrival from an external link | Gallery → place parent or Explore → planning/help as needed |
| “I need a quick reference” | Plan resources → named cheat sheet/capture delivery → relevant detail guides |
| Broken or removed link | 404 → a useful content entrance or service help |

## Success measures

Release acceptance targets are 100% classified content, zero orphan primary public leaves, zero broken emitted internal links, and successful completion of the representative journeys on desktop/mobile/tablet. These are proposed engineering and usability targets, not measured current conversion results.

For a small usability review, ask participants to find a named place, luggage advice, a short layover plan, service expectations and a photo gallery. Record completion and time-to-answer; aim for at least four of five tasks completed independently per participant. Establish the baseline on the current site before claiming improvement.

After release, use the site's consented measurement to review category use, searches without useful results, movement from a guide/place to a shortlist or enquiry, and repeated support questions. Collect aggregate navigation events rather than search text containing personal details. Set conversion targets after observing the baseline; no traffic or conversion uplift is assumed here.

## Implementation sequence

1. **Content foundation.** Confirm this ownership map; add shared taxonomy and a complete resolved registry. Reconcile local/live availability and resource/gallery indexing policy. Preserve current unrelated work.
2. **Universal navigation.** Implement the accepted grouped menu, mobile groups, tablet behavior, footer, breadcrumbs and reliable enquiry/utility actions across every template. Show representative local previews across page families.
3. **Complete discovery.** Reshape Explore/Plan/service entrances, add jump links, contextual next steps, whole-site search and resource/media discovery. Ensure all content is represented through the registry.
4. **Verification and publication.** Run coverage/link-graph checks and representative journeys, marketing build/route tests, Studio schema checks if changed, and final visual checks. Publish the exact reviewed build when authorised, then verify live routes, menus and journeys.

Each phase supports the full content system. The first menu change is only an intermediate implementation milestone; completion means every content family satisfies the acceptance criteria.

## Boundaries and remaining decisions

This is a public website organisation project. It preserves the existing booking/domain model, auth/security boundaries and legal text ownership. New business promises, prices, payment behavior, admin tools and traveler-app redesign require their own work. Existing imagery and the warm editorial design system remain the presentation foundation.

Two product details can be reviewed in the local preview: the public service-menu label (“How Detour works” is recommended) and which popular shortcuts earn space in the grouped menus. Engineering must reconcile availability and gallery/resource indexing intent before the final release. No new question blocks drafting or previewing the structure.

## Implementation evidence pointers

- `apps/marketing/src/lib/site-pages.ts` — local/CMS resolution and legal-route protection.
- `apps/marketing/src/content.config.ts` — current local page schema.
- `apps/marketing/src/pages/[...slug].astro` — distinct legacy/CMS/place/tool/mobile rendering paths.
- `apps/marketing/src/components/FieldNav.astro`, `StructuredPage.astro`, `mobile/MobileShell.astro` — repeated navigation implementations.
- `apps/marketing/src/components/PlaceGuide.astro`, `src/scripts/place-finder.js` — place region/theme/time facets and shortcuts.
- `apps/marketing/src/legacy/guides/index.html` — current complete but long editorial collection.
- `apps/marketing/src/pages/guides/[place]/photos.astro`, `src/pages/sitemap.xml.ts` — gallery/sitemap coverage mismatch.
- `apps/studio/schemaTypes/documents/guide.ts`, `landingPage.ts` — future publishing metadata and author defaults.

## Local implementation and validation

The original 97 HTML routes retain their URLs; `/search` makes 98. `getSiteContent()` resolves the full source library plus the PDF and its authoring source. That registry supplies the shared header/footer, grouped hubs, breadcrumbs, contextual recommendations, search and sitemap.

Implemented visitor journeys:

- Explore Mumbai: direct popular-place links, all seven interest filters and four area shortcuts; the directory adds self-guided walks and food/culture guides.
- Plan your layover: checker and complete guide first, then duration plans, airport essentials, practical travel, weather and personal needs. The PDF resource keeps its existing email capture flow.
- How Detour works: experience, meeting the host, costs, questions and changing flight plans; company/legal/contact utilities are reachable through the footer.
- Search: titles, descriptions and aliases, with section/type filters, useful empty-state recovery and galleries grouped beneath their place. Static links support browsing without client search.
- Place pages and galleries: shared parent breadcrumbs, nearby places, planning recommendations and a browser-tab shortlist available on phones and desktop. Existing account mirroring remains conditional on account configuration.
- Articles: section links work on desktop and phones; a native contents disclosure fills the mobile gap where the old sidebar is hidden.
- Error recovery: search and the principal website entrances.

The legacy transformation retires old global chrome without editing every source article. Desktop and mobile homepage content remains separate, sharing the site-wide navigation. The existing appearance preference is retained through a shared footer control.

All 32 gallery routes enter the sitemap. Private account/system pages remain excluded; the source HTML download carries explicit `noindex` metadata and a deployment header. Studio discovery fields place future published content into the appropriate collections and search; instructions are in `apps/studio/docs/website-discovery.md`.

Validation: marketing production build and route/asset checks pass for 98 routes, with 34 behavior tests. Tests cover reachability from the homepage including all public galleries, navigation anchors, single shared chrome, CMS visibility, gallery ownership, search aliases/filtering and existing timing/lead/consent behavior. Marketing TypeScript and Studio type/schema checks pass. Browser checks cover 320, 390, 768, 1024 and desktop layouts, grouped menus and Escape, search aliases/empty results, saving a place, the place-to-gallery breadcrumb and opening the shortlist planner. Enquiry submission remains covered by the existing transport tests; this review does not claim a new production lead submission.
