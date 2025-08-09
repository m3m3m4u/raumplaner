/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
    './src/contexts/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#bcdcfe',
          300: '#90c7fd',
          400: '#5aa9fa',
          500: '#318bf7',
          600: '#1d6fe5',
          700: '#1658c9',
          800: '#1749a2',
          900: '#183f81'
        }
      },
      boxShadow: {
        'soft': '0 2px 4px -2px rgba(0,0,0,0.08), 0 4px 12px -2px rgba(0,0,0,0.05)'
      },
      borderRadius: {
        'xl': '1rem'
      }
    },
  },
  plugins: [],
};
