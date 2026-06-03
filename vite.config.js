import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// GitHub Pages serves project sites under /<repo>/, so production assets must
// be prefixed with the repo path. Local dev stays at "/".
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/AlphaPartania/' : '/',
  plugins: [react(), tailwindcss()],
}))
