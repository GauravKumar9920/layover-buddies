# Detour — Social Profile Logos

Square 1080×1080 (rendered @2x → 2160px) profile marks for Instagram & LinkedIn.
The composition is **circle-safe** — every element sits inside the inscribed circle, so it
won't get clipped by the round avatar crop on either platform.

| File | Background | Use when |
|---|---|---|
| `detour-avatar-ink.png` | Midnight navy `#0E1929` | **Recommended.** Strongest recognition — terracotta pin + taxi-yellow dot pop on dark. Great for both IG & LinkedIn. |
| `detour-avatar-terra.png` | Terracotta `#C8542A` | Bold, warm, high-energy. Good when surrounded by light feeds. |
| `detour-avatar-paper.png` | Warm cream `#F4EDDD` | Light, editorial. Pairs with the website's paper aesthetic. |

The mark = the Detour "deviation line": a sea-blue (or taxi-yellow) origin dot → a dashed
travel route that bends off-course → the terracotta map pin. The literal detour.

## Regenerate
`avatar.html` is the source. Render any colourway with headless Chrome:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1080,1080 --screenshot="detour-avatar-ink.png" \
  "file://$PWD/avatar.html?v=ink"     # v = paper | terra | ink
```

> Note: these use the icon mark only (no wordmark) — correct for small round avatars.
> For headers/banners/link-previews use the full lockup in `../detour-logo-system.png`.
