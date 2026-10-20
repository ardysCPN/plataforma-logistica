/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF6B00',
          hover: '#E66000',
          light: '#FFF7ED',
          dark: '#C2410C',
        },
        secondary: {
          DEFAULT: '#0F172A',
          surface: '#1E293B',
          border: '#334155',
          light: '#64748B',
        },
        accent: {
          DEFAULT: '#06B6D4',
          light: '#E0F2FE',
        },
        success: {
          DEFAULT: '#10B981',
          surface: '#ECFDF5',
        },
        warning: {
          DEFAULT: '#F59E0B',
          surface: '#FFFBEB',
        },
        danger: {
          DEFAULT: '#EF4444',
          surface: '#FEF2F2',
        },
      },
    },
  },
  plugins: [],
};
