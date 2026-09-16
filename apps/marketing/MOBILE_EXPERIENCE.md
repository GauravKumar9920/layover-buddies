# Independent mobile website

The desktop homepage remains the existing legacy presentation. Under 768 CSS pixels, the homepage uses `MobileHome.astro` with an independent component tree and `mobile.css`. `MobileShell.astro` supplies the mobile navigation, inquiry dialog, footer and bottom action bar on the homepage, guides, place articles and photo collections. Article content is shared; it is not a second content database.

CSS controls the layout before JavaScript runs. `matchMedia('(max-width: 767px)')` manages behaviour changes and closes incompatible dialogs when resizing. There is no user-agent sniffing, separate mobile URL, redirect or device fingerprint. Desktop markup and mobile markup use different IDs. Desktop video loading is guarded on small screens; the desktop hero uses a tiny transparent source on mobile and its normal responsive photo on desktop.

## Mobile flow

- Choose a starting layover window and interest. Save places from the homepage or their guide.
- Preferences and editable inquiry details are saved in session storage for this tab, expiring after 12 hours since the last edit. My places, then Start over, explains what is removed before a separate clear action resets the plan and draft. Successful submission clears contact and flight data. Storage failures leave the current form usable and show a notice.
- Enter actual arrival and departure in Mumbai time. Validate chronology including overnight flights; review the computed layover and all entered details before sending.
- The existing lead transport is shared via `window.DetourLeads.submit`. It preserves the current primary/fallback rules, attribution allowlist and consent-aware analytics. IST offsets are included in transmitted dates. Network calls time out after 20 seconds. Failed submissions remain editable and retryable.
- Native dialogs provide keyboard focus containment, Escape dismissal, and focus return. Reduced transparency and reduced motion have fallbacks. The bottom bar uses safe-area insets and stays clear of consent controls.

## Photographs

Hero source: supplied Vikram SN skyline image in `content/Images/Skyline`. Run `npm run images:mobile --workspace @detour/marketing` to regenerate 480px and 800px portrait WebP derivatives (about 38 KB and 87 KB). Original files are unchanged. Place cards reuse the existing photo manifests and derivatives; credits remain available.

## Verification

`npm run build --workspace @detour/marketing`

`npm run test --workspace @detour/marketing`

The test command checks all 27 routes and runs lead-transport contract tests. Browser checks covered 320, 390, 767, 768, 1024 and 1440px widths; overnight validation; local mocked rejection and success; editing/retry; draft navigation; mobile guides; and the existing desktop booking control. Mock requests never reach the production endpoint. Actual delivery, physical-device performance and production deployment remain separate release checks.

Preview the real build using `npm run preview --workspace @detour/marketing` (use the URL reported by Astro; the current running preview is `http://127.0.0.1:4321/`). Mobile mode is selected by the actual viewport width. Nothing in this change automatically deploys the website.

## Finishing pass

The final local polish adds an outlined SVG brand lockup (including dark-background variant), matching favicon, saved-places drawer with removal controls and an empty state, a persisted three-item preparation checklist, contact links, expanded practical FAQs, and a clean new-request action after success. The logo source is the existing Detour brand typography and route-to-pin geometry; `python3 apps/marketing/scripts/build-logo.py` regenerates the checked-in vector paths using FontTools and the existing local fonts.

Arrivals in the past are now permitted for travellers already at BOM, as long as departure is still in the future and chronology is valid. Both mobile and desktop retain form details on failed submissions. The fallback transport validates the returned success field, with dedicated regression checks against false-positive HTTP 200 responses. The 404 page also carries the mobile navigation and inquiry shell.
