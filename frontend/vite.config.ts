import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const rootDir = resolve(import.meta.dirname, '..')
  const frontend = loadEnv(mode, import.meta.dirname, '')
  const root = loadEnv(mode, rootDir, '')
  // Only this public credential may cross the frontend/backend boundary.
  // Server API keys are never included in define or the browser bundle.
  const mapsKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    frontend.VITE_GOOGLE_MAPS_API_KEY ||
    root.VITE_GOOGLE_MAPS_API_KEY
  // One source of truth for the host-side backend port. If you change
  // BACKEND_HOST_PORT in the root .env, the dev proxy follows automatically.
  const backendHostPort =
    process.env.BACKEND_HOST_PORT || root.BACKEND_HOST_PORT || '3000'
  const apiProxyTarget =
    process.env.VITE_DEV_API_PROXY_TARGET ||
    frontend.VITE_DEV_API_PROXY_TARGET ||
    root.VITE_DEV_API_PROXY_TARGET ||
    `http://localhost:${backendHostPort}`
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
      // Canonical local origin: http://localhost:8080. Keep CORS_ORIGIN,
      // APP_BASE_URL, Playwright, and docs on this exact hostname so the
      // browser and tooling never disagree about IPv4 vs IPv6 loopback.
      port: 8080,
      strictPort: true,
      host: 'localhost',
      proxy: {
        '/api': {
          target: apiProxyTarget,
          // Keep Host so the existing same-site account checks remain valid.
          changeOrigin: false,
        },
      },
    },
  }
})
