/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sakura: {
          50: '#fff1f5',
          100: '#ffe4ec',
          200: '#fecdd9',
          300: '#fda4bc',
          400: '#fb6f97',
          500: '#f43f76',
          600: '#e11d5e',
          700: '#be1248',
          800: '#9d123d',
          900: '#831437',
        },
        cyber: {
          bg: '#0a0a1a',
          card: '#14142a',
          accent: '#7afcff',
          purple: '#b87aff',
          pink: '#ff7ad9',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"PingFang SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2.5s ease-in-out infinite',
        'scan': 'scan 4s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 16px rgba(122,252,255,0.4)' },
          '50%': { boxShadow: '0 0 32px rgba(184,122,255,0.7)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}