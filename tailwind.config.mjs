/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        app: { bg: '#0f172a', surface: '#1e293b', accent: '#f97316', success: '#10b981', danger: '#ef4444', cold: '#3b82f6', warning: '#eab308' }
      }
    },
  },
  plugins: [],
}
