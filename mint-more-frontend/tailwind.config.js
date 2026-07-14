export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f77f00',
          600: '#ea6f00',
          700: '#c95c00',
          800: '#9f4700',
          900: '#7c3500',
        },
        ink: {
          950: '#0b0f14',
          900: '#11161d',
          800: '#1b2128',
          700: '#2a323b',
          600: '#4a535e',
          500: '#6b7480',
          400: '#8e96a0',
          300: '#b2b9c1',
          200: '#d4d8dd',
        }
      },
      fontFamily: {
        sans: ['"Creatyv Public Sans"', 'sans-serif'],
        serif: ['"Creatyv Baskvill"', 'serif'],
        display: ['"Creatyv Hero"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
