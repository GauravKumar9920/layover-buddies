/** @type {import('tailwindcss').Config} */
//
// Mumbai Buddies Tailwind config
// Source of truth: /design/brand/design-system.md
//
// Note on orange/pink palettes: the marketing HTML uses `orange-*` and
// `pink-*` utility classes from the "City of Dreams" saffron-led palette.
// We alias `orange` → saffron scale and `pink` → bougainvillea pink scale
// here so class strings stay readable. `primary-*` / `secondary-*` tokens
// below are the design-system-first names going forward.
//
const SAFFRON = {
  50:  '#FFF7ED',
  100: '#FFEDD5',
  200: '#FED7AA',
  300: '#FDBA74',
  400: '#FB923C',
  500: '#F97316', // DEFAULT — Mumbai Saffron
  600: '#EA580C',
  700: '#C2410C',
  800: '#9A3412',
  900: '#7C2D12',
  950: '#431407',
};
const PINK = {
  50:  '#FDF2F8',
  100: '#FCE7F3',
  200: '#FBCFE8',
  300: '#F9A8D4',
  400: '#F472B6',
  500: '#EC4899', // DEFAULT — Bougainvillea Pink
  600: '#DB2777',
  700: '#BE185D',
  800: '#9D174D',
  900: '#831843',
  950: '#500724',
};

export default {
  content: [
    "./index.html",
    "./know-more.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design-system-first tokens (preferred going forward)
        primary: {
          DEFAULT: SAFFRON[500],
          light:   SAFFRON[100],
          dark:    SAFFRON[700],
          ...SAFFRON,
        },
        secondary: {
          DEFAULT: PINK[500],
          light:   PINK[100],
          dark:    PINK[700],
          ...PINK,
        },
        cream:    '#FFFAF5',  // Warm cream background
        navy:     '#0B1229',  // Midnight navy — primary text / dark surfaces
        charcoal: '#0B1229',  // Legacy alias for existing markup
        gold:     '#F59E0B',  // Marigold — ratings & premium
        success:  '#22C55E',
        warning:  '#F59E0B',
        mumbai:   '#6C5CE7',  // Premium highlights

        // Transitional aliases — existing markup with orange-* / pink-*
        // renders unchanged (identity mapping into the new palette).
        orange: SAFFRON,
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-hero':   'linear-gradient(135deg, #0B1229 0%, #1E293B 50%, #0F172A 100%)',
        'gradient-sunset': 'linear-gradient(135deg, #F97316 0%, #EC4899 100%)',
        'gradient-mumbai': 'linear-gradient(135deg, #6C5CE7 0%, #F97316 100%)',
      },
    },
  },
  plugins: [],
}
