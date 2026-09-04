/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        court: '#0f172a',
        accent: '#34d399',
        glow: '#22c55e',
        orangee: '#f59e0b',
      },
      boxShadow: {
        neon: '0 0 25px rgba(52, 211, 153, 0.35)',
      },
    },
  },
  plugins: [],
}
