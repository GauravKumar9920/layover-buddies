/**
 * Layover Buddies — Design Tokens v2 "City of Dreams"
 * Bold saffron-led palette: Mumbai sunsets, marigolds, bougainvillea,
 * the Arabian Sea at night.
 */
export const theme = {
  colors: {
    // Primary — Mumbai Saffron
    primary:      '#F97316',
    primaryLight: '#FFF7ED',
    primaryDark:  '#EA580C',

    // Secondary — Bougainvillea Pink
    accent:       '#EC4899',
    accentLight:  '#FDF2F8',
    accentDark:   '#BE185D',

    // Backgrounds
    background: '#FFFAF5',   // Warm cream
    surface:    '#FFFFFF',

    // Text — Midnight Navy
    text:          '#0B1229',
    textSecondary: '#64748B',
    textMuted:     '#94A3B8',

    // Semantic
    gold:    '#F59E0B',   // Marigold — ratings & premium
    success: '#22C55E',
    warning: '#F59E0B',
    error:   '#EF4444',
    purple:  '#6C5CE7',  // Mumbai Purple — special events

    // Muted surface (light grey — used for secondary/info CTA backgrounds)
    surfaceMuted: '#F5F5F5',

    // Borders / dividers
    divider: '#E2E8F0',

    // Dark mode surfaces
    dark: {
      background:    '#0B1229',
      surface:       '#1E293B',
      card:          '#334155',
      text:          '#FFFAF5',
      textSecondary: '#94A3B8',
      divider:       '#334155',
    },
  },

  gradients: {
    // Hero/header backgrounds — deep navy depth
    hero: ['#0B1229', '#1E293B', '#0F172A'] as const,
    // Primary CTAs — saffron → bougainvillea
    sunset: ['#F97316', '#EC4899'] as const,
    // Saffron only — less dramatic CTA
    saffron: ['#F97316', '#EA580C'] as const,
    // Golden premium moments
    golden: ['#F59E0B', '#F97316'] as const,
    // Deep navy surfaces
    dark: ['#0B1229', '#1E293B'] as const,
    // Card / guide header
    card: ['#0B1229', '#1E293B'] as const,
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

  borderRadius: {
    sm:   8,
    md:   12,
    lg:   16,
    xl:   24,
    full: 9999,
  },

  shadows: {
    sm: {
      shadowColor:   '#0B1229',
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius:  8,
      elevation:     2,
    },
    md: {
      shadowColor:   '#0B1229',
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius:  20,
      elevation:     4,
    },
    lg: {
      shadowColor:   '#0B1229',
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius:  32,
      elevation:     8,
    },
    xl: {
      shadowColor:   '#0B1229',
      shadowOffset:  { width: 0, height: 16 },
      shadowOpacity: 0.18,
      shadowRadius:  48,
      elevation:     12,
    },
  },

  typography: {
    hero:     { fontSize: 40, fontWeight: '800' as const, lineHeight: 48, letterSpacing: -1 },
    h1:       { fontSize: 32, fontWeight: '700' as const, lineHeight: 40, letterSpacing: -0.5 },
    h2:       { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
    h3:       { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    body:     { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodyBold: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
    caption:  { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    small:    { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
    price:    { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.5 },
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
