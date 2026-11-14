import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// VITE_API_BASE_URL, VITE_TILE_URL and VITE_MAP_ATTRIBUTION are read at build
// time via import.meta.env (R19 / architecture.md §10) — never hardcoded here.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
