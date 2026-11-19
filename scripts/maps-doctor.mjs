import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(
  new URL('../frontend/package.json', import.meta.url),
)
const { loadEnv } = await import(require.resolve('vite'))
const mode =
  process.env.NODE_ENV === 'production' ? 'production' : 'development'
const server = loadEnv(mode, root, '')
const frontend = loadEnv(mode, resolve(root, 'frontend'), 'VITE_')
const browserKey =
  process.env.VITE_GOOGLE_MAPS_API_KEY ||
  frontend.VITE_GOOGLE_MAPS_API_KEY ||
  server.VITE_GOOGLE_MAPS_API_KEY
const serverKey =
  process.env.GOOGLE_MAPS_SERVER_API_KEY || server.GOOGLE_MAPS_SERVER_API_KEY
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'
let failed = false
function result(ok, title, explanation) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${title}: ${explanation}`)
  if (!ok) failed = true
}
console.log(
  'TerraGuessr Google Maps configuration check (credential values are never printed)',
)
result(
  Boolean(browserKey?.trim()),
  'Browser key',
  browserKey?.trim()
    ? 'VITE_GOOGLE_MAPS_API_KEY is present. Browser authorization is checked by the live test.'
    : 'Set VITE_GOOGLE_MAPS_API_KEY in frontend/.env.local (or the root .env).',
)
result(
  Boolean(serverKey?.trim()),
  'Server key',
  serverKey?.trim()
    ? 'GOOGLE_MAPS_SERVER_API_KEY is present.'
    : 'Set GOOGLE_MAPS_SERVER_API_KEY in the root .env, then restart the backend.',
)
try {
  const response = await fetch(`${base}/api/singleplayer/config`, {
    signal: AbortSignal.timeout(5000),
  })
  const data = await response.json()
  result(
    response.ok && data.provider === 'google',
    'Running backend',
    response.ok && data.provider === 'google'
      ? 'The Street View endpoint is reachable through the frontend proxy.'
      : 'The frontend is connected to an old or incorrect backend. Check VITE_DEV_API_PROXY_TARGET and restart Vite.',
  )
  if (response.ok && data.provider === 'google')
    result(
      data.serverKeyConfigured === true,
      'Running server key',
      data.serverKeyConfigured
        ? 'The running backend loaded its server key.'
        : 'The running backend has no server key. Update the root .env and restart it.',
    )
} catch {
  result(
    false,
    'Running application',
    `Cannot reach the updated backend through ${base}. Start the app and verify the API proxy.`,
  )
}
if (serverKey?.trim()) {
  const url = new URL(
    'https://maps.googleapis.com/maps/api/streetview/metadata',
  )
  url.search = new URLSearchParams({
    location: '51.5009,-0.1246',
    radius: '50',
    source: 'outdoor',
    key: serverKey,
  }).toString()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const data = await response.json()
    const status =
      typeof data.status === 'string' && /^[A-Z_]+$/.test(data.status)
        ? data.status
        : 'INVALID_RESPONSE'
    const reasons = {
      REQUEST_DENIED:
        'Check Street View Static API activation, server key IP/API restrictions, and billing in Google Cloud.',
      OVER_QUERY_LIMIT:
        'The Street View quota is exhausted. Check Google Cloud quotas and usage limits.',
      OVER_DAILY_LIMIT: 'Check billing, daily quotas, and the server key.',
      ZERO_RESULTS:
        'No outdoor panorama was returned at the diagnostic location.',
    }
    result(
      response.ok && status === 'OK' && Boolean(data.pano_id),
      'Live server provider',
      status === 'OK'
        ? 'Google returned actual Street View metadata. This does not verify browser Maps or imagery rendering.'
        : `${status}. ${reasons[status] || 'Inspect the project API configuration in Google Cloud.'}`,
    )
  } catch {
    result(
      false,
      'Live server provider',
      'The Google metadata endpoint could not be reached. Check network access.',
    )
  }
}
console.log('Setup: docs/gameplay/GOOGLE_MAPS_SETUP.md')
console.log('After configuring both keys: npm run maps:verify')
process.exitCode = failed ? 1 : 0
