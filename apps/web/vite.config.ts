import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        admin: resolve(__dirname, 'admin.html'),
        compose: resolve(__dirname, 'compose.html'),
        journal: resolve(__dirname, 'journal.html'),
        work: resolve(__dirname, 'work.html'),
        study: resolve(__dirname, 'study.html'),
        search: resolve(__dirname, 'search.html'),
      },
    },
  },
})

