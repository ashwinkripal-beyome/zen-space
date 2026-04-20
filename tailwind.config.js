/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        midnight: {
          900: '#0A0F1A',
          800: '#0F1B2E',
          700: '#1A2538',
          600: '#253549',
        },
        lavender: {
          500: '#A8B8FF',
          400: '#C2D0FF',
        },
        teal: {
          400: '#7DD3C9',
          500: '#5EEAD4',
        },
        blush: {
          400: '#FDB7B5',
          500: '#FCA5A2',
        },
      },
      fontFamily: {
        sans: ['var(--zen-font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--zen-font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--zen-font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-8px)' },
          '30%': { transform: 'translateX(8px)' },
          '45%': { transform: 'translateX(-6px)' },
          '60%': { transform: 'translateX(6px)' },
          '75%': { transform: 'translateX(-3px)' },
        },
      },
      animation: {
        shake: 'shake 0.45s ease-in-out',
      },
    },
  },
  plugins: [],
}
