import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: [
      '**/node_modules/**',
      '**/e2e/**',
      '**/tests/e2e/**'
    ],
    include: [
      'tests/**/*.test.ts'
    ],
  },
});