# Detour Marketing — Start Here

Created 10 June 2026 · Updated after full website implementation.

## Folder map

- **strategy/** — the three planning docs:
  - `01-website-review.md` — the humanization review (✅ now implemented on the site)
  - `02-seo-audit.md` — technical + keyword audit (✅ quick wins implemented; ✅ first 6 guide pages now LIVE — see below)
  - `03-marketing-pipeline-90-days.md` — the zero-budget 90-day plan (live in the Notion tracker)
- **previews/** — screenshots of the rebuilt site before launch, plus the Pexels photo contact sheets used to pick gallery images

## What's already done on the website (`apps/marketing/`)

Images compressed 67MB→4.7MB · keyword title/meta/canonical · Organization + FAQPage schema · robots.txt + sitemap.xml · founder note · visa + solo FAQ · FormSubmit request form + cheat-sheet email capture · street-price ticker · video band (streams from Pexels CDN; run `get-videos.sh` to self-host) · 4 new licensed Pexels photos · App Store / Google Play "coming soon" badges.

## Guide content cluster — LIVE as of 14 June 2026

The `/guides/` SEO cluster (doc 02's #1 strategic investment) is built and deployed. Shared design system in `apps/marketing/assets/site.css` + `booking.js`; each page has Article + FAQPage + BreadcrumbList JSON-LD, the homepage booking modal, and is interlinked. Branded `404.html` added. All in the sitemap; GA4 (`G-54QYM83DKF`) on every page.

- `/guides/mumbai-layover-visa` — keystone (the visa question)
- `/guides/complete-mumbai-layover-guide` — pillar / hub
- `/guides/8-hour-layover-mumbai` · `/guides/12-hour-layover-mumbai` — itineraries
- `/guides/mumbai-airport-luggage-storage` · `/guides/is-mumbai-safe-on-a-layover`

Cheat-sheet **PDF lead magnet** built (`downloads/mumbai-layover-cheat-sheet.pdf`, source HTML alongside) and wired to the homepage capture form. Outreach/content **templates** in `marketing/templates/`. Notion Content Pipeline rows for these are marked Live.

**Still to write (next waves):** 6-hour + overnight itineraries, street-food guide, "meet the buddies" page. **Still manual (Gaurav):** Brevo email platform, Reels, sending pitches, Reddit answers, Google Business Profile + Trustpilot.

## Still needs YOU (can't be done on your behalf)

1. **FormSubmit activation** — after deploying, submit the form once; click the activation link that lands in admin@detourtrips.com. Until then submissions don't deliver.
2. **Google Search Console + GA4 + Bing Webmaster** — needs your Google login. Add the site, submit sitemap.xml.
3. **Rewrite the founder note in your own words** — it's marked with a comment in index.html.
4. **Deploy** — `git add/commit/push` (or `vercel deploy`) when you're happy with the preview.

## The whole strategy in four lines

1. Fix the technical SEO basics (one afternoon, free).
2. Become the best answer on the internet to "what do I do with my Mumbai layover?" — guide pages + Reddit/TripAdvisor answers.
3. Make the site feel like it was made by a person: founder note, real guides, real numbers, no fake ratings.
4. Convert the first 25 travelers free as "founding travelers" and turn each trip into reviews/photos/Reels — the evidence that powers everything after.

## Organizing it (free, solo-founder)

**Recommendation: Notion (free Personal plan)** — you already have it connected here. One page with three databases: Content pipeline (guide pages + Reels, status: idea→draft→live), Outreach CRM (journalists/creators, status: to-pitch→pitched→replied), and Weekly metrics log. Ask Claude to scaffold this in your Notion and import the calendar from doc 03 — five-minute job.

Lighter alternative: Trello free (three lists mirroring the above) if Notion feels heavy. Avoid anything with a per-seat price; you don't need it at one person.
