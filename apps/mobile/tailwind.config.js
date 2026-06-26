/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary palette — Mumbai Saffron
        saffron: '#F97316',
        'saffron-light': '#FFF7ED',
        'saffron-dark': '#EA580C',
        // Accent — Bougainvillea Pink
        pink: '#EC4899',
        'pink-light': '#FDF2F8',
        'pink-dark': '#BE185D',
        cream: '#FFFAF5',
        navy: '#0B1229',
        gold: '#F59E0B',
        purple: '#6C5CE7',
        // Functional
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'System'],
        heading: ['PlusJakartaSans', 'System'],
        mono: ['DMSans', 'Courier'],
      },
    },
  },
  plugins: [],
};
