/** @type {import('tailwindcss').Config} */
//
// Admin tailwind config — kept intentionally close to the root marketing
// site config so the admin UI feels like the same product. Palette mirrors
// /design/brand/design-system.md ("City of Dreams" saffron-led).
//
const SAFFRON = {
  50: '#FFF7ED',
  100: '#FFEDD5',
  200: '#FED7AA',
  300: '#FDBA74',
  400: '#FB923C',
  500: '#F97316',
  600: '#EA580C',
  700: '#C2410C',
  800: '#9A3412',
  900: '#7C2D12',
};
const PINK = {
  50: '#FDF2F8',
  100: '#FCE7F3',
  200: '#FBCFE8',
  300: '#F9A8D4',
  400: '#F472B6',
  500: '#EC4899',
  600: '#DB2777',
  700: '#BE185D',
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: SAFFRON[500], light: SAFFRON[100], dark: SAFFRON[700], ...SAFFRON },
        secondary: { DEFAULT: PINK[500], light: PINK[100], dark: PINK[700], ...PINK },
        cream: '#FFFAF5',
        navy: '#0B1229',
        ink: '#1E293B',
        muted: '#64748B',
        divider: '#E2E8F0',
        success: '#22C55E',
        warn: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        num: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,18,41,0.06), 0 2px 8px rgba(11,18,41,0.04)',
      },
    },
  },
  plugins: [],
};
