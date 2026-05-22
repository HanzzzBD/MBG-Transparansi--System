/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sky: '#b5e0ea',
        primary: '#0071e4',
        navy: '#0f4c81',
        white: '#ffffff',
        lightGray: '#f4f8fb',
        textDark: '#111928',
        textMuted: '#6b7280',
        success: '#057a55',
        warning: '#92400e',
        danger: '#9b1c1c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
