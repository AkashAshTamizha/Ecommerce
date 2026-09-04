/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1',
          50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC',
          400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA',
          800: '#3730A3', 900: '#312E81',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        ink: {
          DEFAULT: '#12173A',
          50: '#F1F2F8',
          100: '#E3E5F1',
          300: '#9297C2',
          400: '#5B6291',
          600: '#2B3167',
          700: '#1E2350',
          800: '#161A3D',
          900: '#0D0F26',
        },
      },
    },
  },
  plugins: [],
};
