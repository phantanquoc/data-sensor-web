/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas-rgb) / <alpha-value>)',
        'canvas-light': 'var(--color-canvas-light)',
        brand: {
          DEFAULT: 'rgb(var(--color-brand-rgb) / <alpha-value>)',
          dark: 'rgb(var(--color-brand-dark-rgb) / <alpha-value>)',
          glow: 'var(--color-brand-glow)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--color-surface-raised-rgb) / <alpha-value>)',
          overlay: 'rgb(var(--color-surface-overlay-rgb) / <alpha-value>)',
        },
        stage: 'rgb(var(--color-stage-rgb) / <alpha-value>)',
        border: {
          DEFAULT: 'rgb(var(--color-border-rgb) / <alpha-value>)',
          active: 'rgb(var(--color-border-active-rgb) / <alpha-value>)',
        },
        val: {
          blue: 'rgb(var(--color-val-blue-rgb) / <alpha-value>)',
          green: 'rgb(var(--color-val-green-rgb) / <alpha-value>)',
          orange: 'rgb(var(--color-val-orange-rgb) / <alpha-value>)',
          purple: 'rgb(var(--color-val-purple-rgb) / <alpha-value>)',
          red: 'rgb(var(--color-val-red-rgb) / <alpha-value>)',
          teal: 'rgb(var(--color-val-teal-rgb) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--color-text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted-rgb) / <alpha-value>)',
        },
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        cardHover: 'var(--shadow-card-hover)',
        pill: 'var(--shadow-pill)',
        glow: 'var(--shadow-glow)',
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
};
