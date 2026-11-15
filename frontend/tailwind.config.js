/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mission: {
          outer: '#060A14',
          bg: '#0B1120',
          card: '#111827',
          border: '#1E293B',
          muted: '#94A3B8',
          accent: '#38BDF8',
          well: '#151F32',
        },
        clinical: {
          outer: '#E2E8F0',
          bg: '#F1F5F9',
          card: '#FFFFFF',
          border: '#CBD5E1',
          well: '#E8EEF5',
          muted: '#64748B',
          accent: '#0284C7',
          text: '#0F172A',
        },
        status: {
          nominal: '#10B981',
          watch: '#D97706',
          action: '#E11D48',
        }
      },
    },
  },
  plugins: [],
}
