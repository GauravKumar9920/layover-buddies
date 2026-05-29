# Detour — Landing site (detourtrips.com)

The public brand/story page for **detourtrips.com**. A single self-contained static
page (`index.html`) — no build step. Promoted from the prototype
`design/brand/detour-brand-site.html`.

- `index.html` — the page (inline CSS/SVG; loads Google Fonts via CDN)
- `images/` — real, web-optimized Mumbai photos (band + duotone specimens)
- `vercel.json` — clean URLs + long-cache headers for `/images`

Faces in the "buddies" section are honest **initials** until real student photos are shot.

## Deploy (Vercel)

**Static — no build.** Two ways:

**A. Vercel CLI (fastest)**
```bash
npm i -g vercel
vercel login
cd landing
vercel --prod          # accept defaults; Framework = Other, no build command
```

**B. Connect the GitHub repo (vercel.com/new)**
- Import the repo → set **Root Directory = `landing`**
- Framework Preset = **Other**, Build Command = *(empty)*, Output Directory = *(empty / `.`)*
- Deploy.

## Custom domain (detourtrips.com)
In the Vercel project → **Settings → Domains → Add** `detourtrips.com` (and `www.detourtrips.com`).
Vercel shows the exact records. Typical at your registrar:
- Apex `detourtrips.com` → **A** record → `76.76.21.21`
- `www` → **CNAME** → `cname.vercel-dns.com`

If the domain is registered with Vercel itself, "Add domain" auto-configures DNS — nothing to paste.

## TODO (post-launch)
- Self-host the Google Fonts for zero external deps.
- Replace buddy initials with real student photos once shot.
- Add a proper OG social-card image (currently reuses the skyline photo).
