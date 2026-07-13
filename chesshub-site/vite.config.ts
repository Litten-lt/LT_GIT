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
        travel: resolve(__dirname, 'travel.html'),
        blog: resolve(__dirname, 'blog.html'),
        figures: resolve(__dirname, 'figures.html'),
        login: resolve(__dirname, 'login.html'),
        life: resolve(__dirname, 'life.html'),
        work: resolve(__dirname, 'work.html'),
        study: resolve(__dirname, 'study.html'),
      },
    },
  },
})