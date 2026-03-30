/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}
