# Detour — SEO Audit (detourtrips.com)

**Date:** 10 June 2026 · **Scope:** Full site audit (index.html + careers.html, live on Vercel)
**Note:** No SEO tool (Ahrefs/Semrush) connected — difficulty/volume are researched estimates. Connecting Ahrefs later will sharpen the numbers, but nothing below depends on it.

---

## Executive Summary

The site's biggest strength is its brand: distinctive design, a clear story, and genuinely good positioning ("verified student buddy" vs. commercial tour operators). Its biggest weakness is that Google has almost nothing to work with: it's a single page with no robots.txt, no sitemap, no structured data, no analytics, and a 65MB image folder where single photos weigh up to 9.8MB. The top 3 priorities: (1) compress images — this alone is killing page speed and Core Web Vitals; (2) ship the crawl basics (robots.txt, sitemap, canonical, JSON-LD, Search Console); (3) build a small `/guides/` content section targeting long-tail layover questions, because the homepage alone can never rank for the queries your customers actually type. Overall assessment: **strong brand, critically thin SEO foundation — but every fix is free and fast.**

---

## Keyword Opportunity Table

Strategy: don't fight Viator/GetYourGuide for "mumbai tours." Win the **layover-specific long tail and question queries** they don't bother with, where you can be the definitive answer.

| Keyword | Difficulty | Opportunity | Intent | Recommended Content |
|---|---|---|---|---|
| mumbai layover tour | Moderate | **High** | Transactional | Homepage title tag + dedicated landing section |
| can I leave mumbai airport during layover | Easy | **High** | Question | Guide page + FAQ schema |
| do I need a visa for a layover in india | Easy | **High** | Question | Visa guide page (your #1 missing content) |
| 8 hour layover in mumbai | Easy | **High** | Informational | Hour-by-hour itinerary page |
| 12 hour layover in mumbai | Easy | **High** | Informational | Hour-by-hour itinerary page |
| overnight layover in mumbai | Easy | **High** | Informational | Guide page |
| mumbai airport luggage storage / left luggage BOM | Easy | **High** | Informational | Practical guide (you already answer this in FAQ) |
| what to do on a layover in mumbai | Easy–Mod | **High** | Informational | Pillar guide ("The Complete Mumbai Layover Guide") |
| is it safe to leave the airport in mumbai | Easy | **High** | Question | Safety guide (esp. solo women travelers) |
| mumbai layover itinerary | Easy | **High** | Informational | Itinerary pages (reuse your 3 "moods") |
| BOM layover guide | Easy | Medium | Informational | Pillar guide |
| mumbai stopover what to see | Easy | Medium | Informational | Pillar guide |
| 6 hour layover mumbai enough to leave airport | Easy | Medium | Question | Itinerary page |
| mumbai airport to gateway of india time | Easy | Medium | Informational | Transport guide |
| local guide mumbai / student guide mumbai | Easy | Medium | Commercial | Homepage + "meet the buddies" page |
| layover tours with locals | Moderate | Medium | Commercial | Homepage copy |
| mumbai layover at night | Easy | Medium | Informational | Guide page |
| transit hotel vs leaving airport mumbai | Easy | Medium | Comparison | Guide page |
| things to eat in mumbai short visit / vada pav near airport | Easy | Medium | Informational | Food guide |
| free walking tour mumbai | Moderate | Medium | Commercial | "Free in early access" angle page |
| mumbai e-visa for transit how long does it take | Easy | **High** | Question | Visa guide |
| is mumbai worth leaving the airport for | Easy | Medium | Question | Pillar guide / blog |

**AI-answer engines matter too:** travelers increasingly ask ChatGPT/Gemini "what should I do on my Mumbai layover?" Clear, factual, well-structured guide pages with FAQ schema are exactly what gets cited.

---

## On-Page Issues Table

| Page | Issue | Severity | Fix |
|---|---|---|---|
| index.html | Title tag has zero keywords: "Detour — See the city through a local friend." | **Critical** | `Mumbai Layover Tours with Local Student Guides | Detour` (under 60 chars, keeps brand) |
| index.html | Gallery/step images are 5–9.8MB each (65MB folder total) | **Critical** | Resize to max 1600px wide, convert to WebP (~100–250KB each). Free: squoosh.app or `cwebp`. Add explicit `width`/`height` to prevent layout shift |
| site-wide | Only one indexable page — no surface for any layover query | **Critical** | Add `/guides/` static pages (see Content Gaps) |
| index.html | No JSON-LD structured data despite having a real FAQ | High | Add `FAQPage` schema (your 4 FAQ answers, verbatim), `Organization` schema (logo, email, Instagram), and `TouristTrip` for the 3 itineraries |
| index.html | Meta description lacks "layover tour"; H1 is good but supporting H2s never use search phrasing | High | Description: "Turn your Mumbai layover into the best part of your trip. Verified local student guides, routes built around your flight, free in early access." H2s can keep their voice — add one keyword-bearing H2 per section |
| index.html | No canonical tag | Medium | `<link rel="canonical" href="https://detourtrips.com/">` (also on careers) |
| index.html | 3 of 20 images missing alt text | Medium | Add descriptive alts with natural keywords ("Vada pav stall in Dadar, Mumbai") |
| index.html | Primary CTA is a `mailto:` link | High (conversion, not ranking) | Replace with a free Tally.so form + WhatsApp link — mailto silently fails for everyone using Gmail in a browser |
| site-wide | No analytics, no Search Console | **Critical** (you're flying blind) | GA4 (free) + Google Search Console (free) + Bing Webmaster Tools (free; also feeds ChatGPT search) |
| careers.html | Fine overall | Low | Add canonical + Organization schema |

---

## Content Gap Recommendations

Your competitors for layover queries are weak (one Viator listing page, a couple of personal blogs). A focused content cluster can own this space.

1. **"Do I need a visa to leave Mumbai airport on a layover?"** — Highest priority. This is the #1 blocker in every traveler's head and your site never mentions it. Cover: e-visa process, cost (~$25), processing time, 72-hour transit rules, what happens at immigration. Format: guide page + FAQ schema. *Effort: half day. Priority: HIGH.*
2. **Pillar: "The Complete Mumbai Layover Guide (BOM)"** — 2,500+ words: visa, luggage storage, time budgeting (immigration takes X, Sea Link takes Y), what's doable in 6/8/12/24h, safety, costs, SIM/payment tips. Links to every other guide. *Effort: 1 day. Priority: HIGH.*
3. **Hour-by-hour itineraries: 6h / 8h / 12h / overnight** — Reuse your three "moods" (Postcard, Hyper-local, Old Bombay) as real itineraries with timings and costs. 4 pages, mostly templated. *Effort: half day each. Priority: HIGH.*
4. **"Mumbai airport luggage storage: the complete guide"** — You already know this cold; competitors answer it badly. *Quick win: 1–2 hours.*
5. **"Is Mumbai safe to explore on a layover?"** — Address solo travelers and solo women directly; this is the #1 hesitation after visas. Honest, specific, not defensive. *Effort: half day. Priority: HIGH.*
6. **"Meet the buddies" page** — Real student profiles (with consent): name, college, favorite corner of Mumbai. Ranks for "local guide mumbai," and it's your strongest humanity/trust asset (see website review doc). *Effort: half day once you have photos.*
7. **Transit hotel vs. going out comparison** — captures people who haven't decided yet. *Quick win.*

Implementation note: keep it static like the rest of the site — `/guides/mumbai-layover-visa.html` etc., same design language, interlinked, each with FAQ schema. No CMS needed.

---

## Technical SEO Checklist

| Check | Status | Details |
|---|---|---|
| HTTPS | ✅ Pass | Vercel default |
| Mobile viewport | ✅ Pass | Configured |
| Single H1 | ✅ Pass | One H1, lazy-loading on 21 images |
| robots.txt | ❌ Fail | Missing. Add one allowing all + sitemap line |
| XML sitemap | ❌ Fail | Missing. List index, careers, future guides; submit in Search Console |
| Canonical tags | ❌ Fail | None on either page |
| Structured data | ❌ Fail | Zero JSON-LD. FAQ schema is the cheapest SERP-feature win available to you |
| Page weight / LCP | ❌ Fail | Multi-MB images; LCP will be poor on hotel/airport Wi-Fi — literally your audience |
| Image alt text | ⚠️ Warning | 3 missing |
| Indexation monitoring | ❌ Fail | No Search Console property |
| Analytics | ❌ Fail | No GA4/any tracker |
| og:/twitter: tags | ⚠️ Warning | Good base; add `twitter:title`, `twitter:description`, `og:site_name`, `og:locale` |
| Custom 404 | ⚠️ Warning | Add a branded 404 pointing back home |

---

## Competitor Comparison Summary

| Dimension | Detour | Viator / GetYourGuide | yourlayoverguide.com / blogs |
|---|---|---|---|
| Domain authority | Very low (new) | Very high | Low–medium |
| Layover-specific content depth | None yet | Thin listing pages | Medium, generic, often outdated |
| Price/positioning | Free early access, local students | $50–150, commercial guides | N/A (content only) |
| SERP features | None | Reviews stars, listings | Some featured snippets |
| Realistic head-to-head | — | Don't compete on "mumbai tours" | **Beatable on every long-tail query** |

Verdict: aggregators win head terms on authority; nobody owns the question-and-itinerary space for BOM. That's your lane.

---

## Prioritized Action Plan

**Quick wins (this week, all free):**
1. Compress every image to WebP ≤250KB (squoosh.app) — biggest single performance gain. *Impact: high. ~2h.*
2. Rewrite title tag + meta description with "Mumbai layover" phrasing. *Impact: high. 15 min.*
3. Add robots.txt, sitemap.xml, canonicals. *Impact: high. 30 min.*
4. Add FAQPage + Organization JSON-LD. *Impact: high. 1h.*
5. Set up Google Search Console, Bing Webmaster Tools, GA4; submit sitemap. *Impact: high. 1h.*
6. Fix 3 missing alts; add width/height to images. *Impact: medium. 30 min.*
7. Replace mailto CTA with Tally form + WhatsApp. *Impact: high (conversion). 1–2h.*

**Strategic investments (this quarter):**
1. Publish the visa guide + pillar guide first, then 2 guide pages/week until the cluster (~8–10 pages) is live. *Impact: very high. Dependency: none.*
2. Add "Meet the buddies" page with real profiles. *Impact: high (trust + SEO).*
3. Earn first backlinks via the PR/community plan (see 03-marketing-pipeline). *Impact: high. Dependency: guides live first — give journalists something to link to.*
4. Add visa + safety questions to the homepage FAQ (and schema). *Impact: medium.*
