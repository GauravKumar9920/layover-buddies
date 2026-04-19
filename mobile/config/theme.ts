export const theme = {
  colors: {
    primary: '#0D7377',
    primaryLight: '#E8F5F5',
    primaryDark: '#095456',
    accent: '#FF6B6B',
    accentLight: '#FFE8E8',
    accentDark: '#E55555',
    background: '#F8F5F0',
    surface: '#FFFFFF',
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    gold: '#F5A623',
    success: '#27AE60',
    warning: '#F39C12',
    error: '#E55555',
    purple: '#6C5CE7',
    divider: '#E5E7EB',

    dark: {
      background: '#0F0F1A',
      surface: '#1A1A2E',
      card: '#252540',
      text: '#F8F5F0',
      textSecondary: '#A0A0B0',
      divider: '#3D3D4D',
    },
  },

  gradients: {
    hero: ['#0D7377', '#095456', '#1A1A2E'] as const,
    sunset: ['#FF6B6B', '#F5A623'] as const,
    card: ['#0D7377', '#0A5F62'] as const,
    dark: ['#1A1A2E', '#0F0F1A'] as const,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  shadows: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 32,
      elevation: 12,
    },
  },

  typography: {
    hero: { fontSize: 40, fontWeight: '800' as const, lineHeight: 48, letterSpacing: -1 },
    h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40, letterSpacing: -0.5 },
    h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodyBold: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
    caption: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    small: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
    price: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.5 },
  },

  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    floating: 30,
    modal: 40,
    toast: 50,
    topmost: 100,
  },
} as const;

export type Theme = typeof theme;
