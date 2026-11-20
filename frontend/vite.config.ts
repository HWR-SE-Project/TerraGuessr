import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const frontend = loadEnv(mode, import.meta.dirname, 'VITE_')
  const root = loadEnv(mode, resolve(import.meta.dirname, '..'), 'VITE_')
  // Only this public credential may cross the frontend/backend boundary.
  // Server API keys are never included in define or the browser bundle.
  const mapsKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    frontend.VITE_GOOGLE_MAPS_API_KEY ||
    root.VITE_GOOGLE_MAPS_API_KEY
  return {
    plugins: [react()],
    define:
      mode !== 'test' && mapsKey
        ? {
            'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(mapsKey),
          }
        : {},
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/vitest.setup.ts'],
      globals: true,
    },
    server: {
      // Explicit IPv4 loopback: plain 'localhost' resolves to the IPv6
      // loopback first on this host, which left http://127.0.0.1:5173
      // (used by maps-doctor.mjs, verify-live-game.mjs, and some tooling)
      // unable to connect at all.
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target:
            process.env.VITE_DEV_API_PROXY_TARGET ||
            frontend.VITE_DEV_API_PROXY_TARGET ||
            root.VITE_DEV_API_PROXY_TARGET ||
            'http://localhost:3000',
          // Keep Host so the existing same-site account checks remain valid.
          changeOrigin: false,
        },
      },
    },
  }
})
