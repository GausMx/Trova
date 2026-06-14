/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f2f8f4',
          100: '#e1efe6',
          200: '#c2decb',
          300: '#94c5a5',
          400: '#62a579',
          500: '#3e8857',
          600: '#2d6d42',
          700: '#235634',
          800: '#1b442a',
          900: '#0B3B1E', // Custom Primary Forest Green
          950: '#062010',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
