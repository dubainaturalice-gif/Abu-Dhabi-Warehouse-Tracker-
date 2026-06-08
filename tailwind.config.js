/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#040d1a',
          800: '#0A1628',
          700: '#0f1f36',
          600: '#1a2f4a',
          500: '#1e3a5f',
        },
        teal: {
          600: '#0d9488',
          500: '#14b8a6',
          400: '#2dd4bf',
        },
      },
    },
  },
  plugins: [],
};
