/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#ebe4d8',
        'bg-soft': '#f3ede1',
        ink: '#2b2a28',
        'ink-soft': '#5a5751',
        accent: '#c25a4a',
        'accent-soft': 'rgba(194, 90, 74, 0.08)',
        'social': '#c58582',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"PingFang SC"', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces"', '"Source Han Serif SC"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}