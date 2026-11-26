import { api } from '../services'
import { preloadBiomeDiorama } from '../scene/diorama/preload'

const WARM_COOLDOWN_MS = 60_000
let lastWarmAt = 0

/**
 * Best-effort warm-up before the player clicks "Start exploring":
 *  1. Primes the backend's in-memory Round 1 warm pool (and wakes Render if asleep).
 *  2. Preloads the lazy 3D BiomeDiorama chunk in the browser.
 *
 * Throttled so hovering on Home + landing on /singleplayer only sends one request,
 * and skipped in unit tests to avoid unmocked background network/WebGL imports.
 */
export function warmSingleplayer(): void {
  if (import.meta.env.MODE === 'test') return
  void preloadBiomeDiorama().catch(() => {})
  const now = Date.now()
  if (now - lastWarmAt < WARM_COOLDOWN_MS) return
  lastWarmAt = now
  void api.singleplayer.warm().catch(() => {
    lastWarmAt = 0
  })
}
