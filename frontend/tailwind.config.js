/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b6bff',
          dark: '#2340cf',
          light: '#5b82ff',
          purple: '#7c5cff',
        },
        success: '#0fc27b',
        danger: '#f43f5e',
        warn: '#f59e0b',
        purple: '#8b5cf6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,18,32,.05), 0 10px 26px -16px rgba(11,18,32,.22)',
        modal: '0 30px 80px -20px rgba(0,0,0,.55)',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      keyframes: {
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to: { opacity: 1, transform: 'none' },
        },
        'fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'slide-up': 'slide-up .35s cubic-bezier(.2,.9,.3,1.2)',
        'fade-in': 'fade-in .3s ease',
      },
    },
  },
  plugins: [],
};