import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.ts'],
    globals: true,
  },
  server: {
    proxy: {
      // Same-origin in dev: avoids CORS entirely and lets session cookies
      // (SameSite, no explicit CORS_ORIGIN needed) work exactly like prod,
      // where Caddy proxies /api to the backend from the same origin.
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3000',
        // changeOrigin must stay false: the backend's same-site check compares
        // the request Host header against the browser's Origin header. Rewriting
        // Host to the backend's own address would desync them and 403 every
        // mutation (register/login/etc.) even though the request is same-origin
        // from the browser's point of view.
        changeOrigin: false,
      },
    },
  },
})
