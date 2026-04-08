/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f0f8',
          100: '#dcdcef',
          200: '#b8b8df',
          300: '#8e8ec8',
          400: '#6a6ab0',
          500: '#4d4d8a',
          600: '#3a3a6b',
          700: '#2d2d56',
          800: '#232342',
          900: '#1a1a2e',
          950: '#12121f',
        },
        accent: {
          DEFAULT: '#00b4d8',
          dark: '#0096b7',
          light: '#48cae4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
