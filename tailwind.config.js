/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary':     'rgb(var(--bg-primary-rgb) / <alpha-value>)',
        'bg-secondary':   'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
        'bg-tertiary':    'rgb(var(--bg-tertiary-rgb) / <alpha-value>)',
        'accent-blue':    'rgb(var(--accent-blue-rgb) / <alpha-value>)',
        'accent-green':   'rgb(var(--accent-green-rgb) / <alpha-value>)',
        'accent-amber':   'rgb(var(--accent-amber-rgb) / <alpha-value>)',
        'accent-red':     'rgb(var(--accent-red-rgb) / <alpha-value>)',
        'text-primary':   'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'border-color':   'rgb(var(--border-color-rgb) / <alpha-value>)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
