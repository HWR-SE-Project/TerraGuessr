import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const cwd = fileURLToPath(new URL('..', import.meta.url))
const doctor = spawnSync(process.execPath, ['scripts/maps-doctor.mjs'], {
  cwd,
  stdio: 'inherit',
  env: process.env,
})
if (doctor.status !== 0) process.exit(doctor.status || 1)
const test = spawnSync(
  process.execPath,
  [
    'node_modules/@playwright/test/cli.js',
    'test',
    'e2e/singleplayer.live.spec.ts',
  ],
  {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      TERRAGUESSR_LIVE_MAPS: '1',
      PLAYWRIGHT_BASE_URL:
        process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    },
  },
)
process.exitCode = test.status || (test.error ? 1 : 0)
