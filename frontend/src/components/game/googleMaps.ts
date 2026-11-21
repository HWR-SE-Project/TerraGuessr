// Loads the Google Maps JavaScript API once and shares the result. The browser
// key is a public, HTTP-referrer-restricted credential (VITE_GOOGLE_MAPS_API_KEY).

let loading: Promise<typeof google.maps> | null = null
const failureListeners = new Set<() => void>()

export function onMapsAuthFailure(listener: () => void) {
  failureListeners.add(listener)
  return () => failureListeners.delete(listener)
}

export const browserMapsKey = () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!browserMapsKey()) return Promise.reject(new Error('Maps credentials are missing.'))
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const target = window as typeof window & {
      terraMapsReady?: () => void
      gm_authFailure?: () => void
    }
    const script = document.createElement('script')
    const timeout = window.setTimeout(
      () => fail('The map provider took too long to respond. Check your connection and retry.'),
      20000,
    )
    const clean = () => {
      window.clearTimeout(timeout)
      delete target.terraMapsReady
    }
    function fail(message: string) {
      clean()
      script.remove()
      loading = null
      reject(new Error(message))
    }
    target.gm_authFailure = () => {
      failureListeners.forEach((listener) => listener())
      fail('Google Maps access was denied. Check API activation, billing, and key restrictions.')
    }
    target.terraMapsReady = () => {
      clean()
      resolve(google.maps)
    }
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserMapsKey())}&v=quarterly&loading=async&callback=terraMapsReady`
    script.async = true
    script.onerror = () => fail('Could not load Google Maps. Check your connection and retry.')
    document.head.appendChild(script)
  })
  return loading
}
