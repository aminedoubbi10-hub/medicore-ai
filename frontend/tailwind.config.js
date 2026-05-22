/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#040810',
          2: '#070d1a',
          3: '#0c1428',
        },
        surface: {
          DEFAULT: '#0f1a2e',
          2: '#152035',
          3: '#1a2840',
        },
        border: {
          DEFAULT: '#1e3050',
          2: '#253a5e',
        },
        accent: {
          DEFAULT: '#00d4ff',
          2: '#0099cc',
          3: '#004466',
        },
        medical: {
          green: '#00e5a0',
          red: '#ff4d6d',
          amber: '#ffb347',
          purple: '#a78bfa',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [],
};
