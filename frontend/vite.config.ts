import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const rootDir = resolve(import.meta.dirname, '..')
  const frontend = loadEnv(mode, import.meta.dirname, '')
  const root = loadEnv(mode, rootDir, '')
  // One source of truth for the host-side backend port.
  const backendHostPort =
    process.env.BACKEND_HOST_PORT || root.BACKEND_HOST_PORT || '3000'
  const apiProxyTarget =
    process.env.VITE_DEV_API_PROXY_TARGET ||
    frontend.VITE_DEV_API_PROXY_TARGET ||
    root.VITE_DEV_API_PROXY_TARGET ||
    `http://localhost:${backendHostPort}`
  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
    },
    server: {
      port: 8080,
      strictPort: true,
      host: 'localhost',
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: false,
        },
      },
    },
  }
})
