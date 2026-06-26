/**
 * Detour — Design Tokens v3 "Warm Editorial"
 *
 * Ported from the live marketing site (apps/marketing/index.html) so the app
 * and the brand page feel like the same hand-built Mumbai travel zine:
 * paper canvas, ink type, marigold / terracotta / sea accents, mono labels.
 *
 * The token KEYS are unchanged from v2 so every screen that reads
 * `theme.colors.primary`, `theme.typography.h2`, etc. inherits the new look
 * automatically — only the VALUES moved.
 */

// ── Raw palette (matches the marketing site CSS variables) ──────────────────
const palette = {
  // Paper (warm cream canvas + raised surfaces)
  paper:    '#F4EDDD',   // page canvas
  paperLt:  '#FCF7EA',   // lightest — cards / raised surfaces
  paperDp:  '#EBE0C5',   // deep — insets / muted fills
  paperLn:  '#C5BA9C',   // soft paper line

  // Ink (near-black navy)
  ink:      '#0E1929',
  ink2:     '#1F2A3D',
  inkMute:  '#445169',
  inkSoft:  '#7C8597',

  // Accents
  marigold:   '#E89F2C', marigoldLt: '#FBEACB',
  terracotta: '#C8542A', terraDk:    '#9E3A1F', terraLt: '#F7DECC',
  sea:        '#2D7BA9', seaDk:      '#1F5B7E', seaLt:   '#C9DEEB',
  taxi:       '#F4C430',
  pink:       '#D4347A',
  olive:      '#5E7A2C',
  green:      '#3D8B5A',
  red:        '#C0392B',
  purple:     '#6C5CE7',
} as const;

// ── Font families (registered 1:1 in app/_layout.tsx via useFonts) ──────────
// Reference these by their registered keys. In React Native a custom
// fontFamily already carries its weight (one file per weight), so the
// fontWeight on each typography token is only a graceful-fallback hint.
export const fonts = {
  display:     'Bricolage_700Bold',
  displayX:    'Bricolage_800ExtraBold',
  displaySemi: 'Bricolage_600SemiBold',
  serif:       'InstrumentSerif_400Regular',
  body:        'Jakarta_400Regular',
  bodyMed:     'Jakarta_500Medium',
  bodySemi:    'Jakarta_600SemiBold',
  bodyBold:    'Jakarta_700Bold',
  mono:        'DMMono_400Regular',
  monoMed:     'DMMono_500Medium',
} as const;

export const theme = {
  fonts,

  colors: {
    // Primary — Terracotta (main brand action / CTAs)
    primary:      palette.terracotta,
    primaryLight: palette.terraLt,
    primaryDark:  palette.terraDk,

    // Secondary — Sea blue (links, info actions, the cool counterpoint)
    accent:       palette.sea,
    accentLight:  palette.seaLt,
    accentDark:   palette.seaDk,

    // Backgrounds — paper, not white
    background:   palette.paper,
    surface:      palette.paperLt,
    surfaceMuted: palette.paperDp,

    // Text — ink
    text:          palette.ink,
    textSecondary: palette.inkMute,
    textMuted:     palette.inkSoft,

    // Semantic
    gold:    palette.marigold,   // ratings & premium
    success: palette.green,
    warning: palette.marigold,
    error:   palette.red,
    purple:  palette.purple,

    // Borders / dividers
    divider:  palette.paperLn,   // soft warm hairline (default)
    inkLine:  palette.ink,       // hard ink border (deliberate framing)

    // Extra named accents (available for chips, tags, illustrations)
    marigold:   palette.marigold,
    terracotta: palette.terracotta,
    sea:        palette.sea,
    taxi:       palette.taxi,
    pink:       palette.pink,
    olive:      palette.olive,

    // Dark mode surfaces (ink-led)
    dark: {
      background:    palette.ink,
      surface:       palette.ink2,
      card:          '#26344A',
      text:          palette.paperLt,
      textSecondary: '#9FB0C4',
      divider:       '#2C3B52',
    },
  },

  gradients: {
    // Hero / header backgrounds — deep ink depth
    hero:    [palette.ink, palette.ink2] as const,
    // Primary CTA accent — terracotta → marigold (use sparingly; flat is default)
    sunset:  [palette.terracotta, palette.marigold] as const,
    // Terracotta only
    saffron: [palette.terracotta, palette.terraDk] as const,
    // Golden / premium moments
    golden:  [palette.marigold, palette.taxi] as const,
    // Sea
    sea:     [palette.sea, palette.seaDk] as const,
    // Deep ink surfaces
    dark:    [palette.ink, palette.ink2] as const,
    // Card / guide header
    card:    [palette.ink, palette.ink2] as const,
  },

  spacing: {
    xs:   4,
    sm:   8,
    md:   12,
    lg:   16,
    xl:   24,
    xxl:  32,
    xxxl: 48,
  },

  // Editorial = a touch less rounded than v2; pairs with hairline ink borders.
  borderRadius: {
    sm:   6,
    md:   10,
    lg:   14,
    xl:   20,
    full: 9999,
  },

  // Soft, ink-tinted shadows that sit over hairline borders — approximating
  // the site's layered `--shadow-card`.
  shadows: {
    sm: {
      shadowColor:   palette.ink,
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius:  8,
      elevation:     2,
    },
    md: {
      shadowColor:   palette.ink,
      shadowOffset:  { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius:  20,
      elevation:     4,
    },
    lg: {
      shadowColor:   palette.ink,
      shadowOffset:  { width: 0, height: 12 },
      shadowOpacity: 0.10,
      shadowRadius:  32,
      elevation:     8,
    },
    xl: {
      shadowColor:   palette.ink,
      shadowOffset:  { width: 0, height: 20 },
      shadowOpacity: 0.12,
      shadowRadius:  44,
      elevation:     12,
    },
  },

  typography: {
    // Display — Bricolage Grotesque
    hero:     { fontFamily: fonts.displayX,    fontSize: 40, fontWeight: '800' as const, lineHeight: 46, letterSpacing: -1 },
    h1:       { fontFamily: fonts.display,     fontSize: 30, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.5 },
    h2:       { fontFamily: fonts.display,     fontSize: 24, fontWeight: '700' as const, lineHeight: 30, letterSpacing: -0.3 },
    h3:       { fontFamily: fonts.displaySemi, fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
    // Editorial headline — Instrument Serif (use for warm, human moments)
    serif:    { fontFamily: fonts.serif,       fontSize: 32, fontWeight: '400' as const, lineHeight: 36, letterSpacing: -0.2 },
    // Mono eyebrow label — the signature kicker above headings
    eyebrow:  { fontFamily: fonts.mono,        fontSize: 11, fontWeight: '500' as const, lineHeight: 16, letterSpacing: 1.5, textTransform: 'uppercase' as const },
    // Body — Plus Jakarta Sans
    body:     { fontFamily: fonts.body,        fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodyBold: { fontFamily: fonts.bodySemi,    fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
    caption:  { fontFamily: fonts.body,        fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    small:    { fontFamily: fonts.bodyMed,     fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
    // Numerals / prices — DM Mono (mono figures are a brand signature)
    price:    { fontFamily: fonts.monoMed,     fontSize: 26, fontWeight: '500' as const, lineHeight: 30, letterSpacing: -0.5 },
    mono:     { fontFamily: fonts.mono,        fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  },

  zIndex: {
    base:     0,
    dropdown: 10,
    sticky:   20,
    floating: 30,
    modal:    40,
    toast:    50,
    topmost:  100,
  },
} as const;

export type Theme = typeof theme;
