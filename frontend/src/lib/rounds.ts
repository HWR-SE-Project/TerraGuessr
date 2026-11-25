import type { RoundBounds } from './contracts'

// Mirrors backend/src/config/constants.ts so singleplayer and multiplayer stay
// consistent before /api/game-rules finishes loading.
export const MIN_ROUNDS_TOTAL = 3
export const MAX_ROUNDS_TOTAL = 10
export const DEFAULT_ROUNDS_TOTAL = 5

export const DEFAULT_ROUND_BOUNDS: RoundBounds = {
  min: MIN_ROUNDS_TOTAL,
  max: MAX_ROUNDS_TOTAL,
  default: DEFAULT_ROUNDS_TOTAL,
}

const SINGLEPLAYER_ROUNDS_KEY = 'terraguessr.singleplayerRounds.v1'
const ENDLESS_VALUE = 'endless'

export function resolveRoundBounds(bounds?: RoundBounds | null): RoundBounds {
  if (!bounds) return DEFAULT_ROUND_BOUNDS
  return bounds
}

export function clampRounds(value: number, bounds: RoundBounds = DEFAULT_ROUND_BOUNDS): number {
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)))
}

/**
 * Reads the player's last singleplayer round choice from storage.
 * Returns a finite round count (3..10) or `null` for endless mode.
 */
export function readStoredSingleplayerRounds(bounds: RoundBounds = DEFAULT_ROUND_BOUNDS): number | null {
  try {
    const saved = localStorage.getItem(SINGLEPLAYER_ROUNDS_KEY)
    if (saved === ENDLESS_VALUE) return null
    if (saved !== null) {
      const parsed = Number(saved)
      if (Number.isInteger(parsed) && parsed >= bounds.min && parsed <= bounds.max) {
        return parsed
      }
    }
    return bounds.default
  } catch {
    return bounds.default
  }
}

export function storeSingleplayerRounds(roundsTotal: number | null): void {
  try {
    localStorage.setItem(
      SINGLEPLAYER_ROUNDS_KEY,
      roundsTotal === null ? ENDLESS_VALUE : String(roundsTotal),
    )
  } catch {
    /* ignore */
  }
}
