/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 30px rgba(16, 185, 129, 0.35)',
      },
      colors: {
        accent: '#34d399',
        court: '#0f172a',
      },
    },
  },
  plugins: [],
}
