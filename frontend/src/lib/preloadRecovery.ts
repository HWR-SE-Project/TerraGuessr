const RELOAD_STORAGE_KEY = 'terraguessr:preload-reload-at'
const RELOAD_COOLDOWN_MS = 15_000

/**
 * Recovers from stale lazy-chunk errors after a new deployment.
 *
 * When a user keeps an older tab open across a deploy, dynamic imports for
 * replaced hashed chunks fail and Vite dispatches `vite:preloadError`. We
 * reload once to fetch the fresh index.html and asset manifest, guarded by a
 * short sessionStorage cooldown so a genuinely broken asset cannot trigger an
 * infinite reload loop.
 */
export function installPreloadErrorRecovery(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  reload: () => void = () => window.location.reload(),
  now: () => number = () => Date.now(),
): () => void {
  const handlePreloadError = (event: Event) => {
    let lastReloadAt = 0
    try {
      const raw = window.sessionStorage.getItem(RELOAD_STORAGE_KEY)
      lastReloadAt = raw ? Number(raw) : 0
    } catch {
      // Storage may be blocked in restricted browser contexts — skip auto-reload
      // so we cannot enter an unguarded reload loop.
      return
    }

    const currentTime = now()
    if (Number.isFinite(lastReloadAt) && currentTime - lastReloadAt < RELOAD_COOLDOWN_MS) {
      return
    }

    try {
      window.sessionStorage.setItem(RELOAD_STORAGE_KEY, String(currentTime))
    } catch {
      return
    }

    event.preventDefault()
    reload()
  }

  target.addEventListener('vite:preloadError', handlePreloadError)
  return () => target.removeEventListener('vite:preloadError', handlePreloadError)
}
