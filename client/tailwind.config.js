/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f2f4f7',
        brand: {
          DEFAULT: '#2196f3',
          dark: '#1976d2',
        },
        stage: '#1f3c88',
        val: {
          blue: '#007bff',
          green: '#28a745',
          orange: '#fd7e14',
          purple: '#6f42c1',
          red: '#dc3545',
          teal: '#17a2b8',
        },
      },
      boxShadow: {
        card: '0 4px 15px rgba(0, 0, 0, 0.1)',
        cardHover: '0 8px 18px rgba(25, 118, 210, 0.18)',
        pill: '0 4px 12px rgba(0, 123, 255, 0.35)',
      },
      fontFamily: {
        sans: ['Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
