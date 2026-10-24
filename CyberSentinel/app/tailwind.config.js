/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
          navy: '#0b2038',
          saffron: '#e65100',
        },
        senior: {
          bg: '#f8fafc',
          card: '#ffffff',
          text: '#0f172a',
          muted: '#475569',
          border: '#cbd5e1',
          accent: '#1e3a8a',
          safe: '#15803d',
          danger: '#b91c1c',
          warning: '#b45309'
        }
      },
      fontFamily: {
        sans: ['Lexend', 'Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Outfit', 'Lexend', 'sans-serif']
      },
      boxShadow: {
        'solid-sm': '0 2px 0 0 rgba(15, 23, 42, 0.08)',
        'solid': '0 4px 0 0 rgba(15, 23, 42, 0.12)',
        'solid-lg': '0 6px 0 0 rgba(15, 23, 42, 0.16)',
      }
    },
  },
  plugins: [],
}
