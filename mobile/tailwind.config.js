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
        // Primary palette
        teal: '#0D7377',
        'teal-light': '#E8F5F5',
        'teal-dark': '#095456',
        coral: '#FF6B6B',
        'coral-light': '#FFE8E8',
        'coral-dark': '#E55555',
        cream: '#F8F5F0',
        charcoal: '#1A1A2E',
        gold: '#F5A623',
        purple: '#6C5CE7',
        // Functional
        success: '#27AE60',
        warning: '#F39C12',
        error: '#E55555',
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
