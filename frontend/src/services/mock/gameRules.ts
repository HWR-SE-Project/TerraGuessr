import type { Difficulty, GameRules } from '../../lib/contracts'

const RULES: Record<Difficulty, GameRules> = {
  easy: { timeLimitSeconds: 420, attemptsPerRound: 3, selectionMode: 'list', countryBorders: true, extraData: { mode: 'free' } },
  medium: { timeLimitSeconds: 240, attemptsPerRound: 2, selectionMode: 'map', countryBorders: true, extraData: { mode: 'points', cost: 100 } },
  hard: { timeLimitSeconds: 120, attemptsPerRound: 1, selectionMode: 'map', countryBorders: true, extraData: { mode: 'time', cost: 20 } },
}

export function mockGameRules(difficulty: Difficulty): GameRules {
  return RULES[difficulty]
}

const EARTH_RADIUS_KM = 6371.0088

/** Great-circle distance in kilometres between two lat/lon points. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Mirrors backend/src/domain/scoring.ts (R10): 5000 points under 100 km,
// 0 beyond 20000 km, linear decay between, computed on the one-decimal
// rounded distance and floored.
export const MAX_SCORE = 5000
const FULL_SCORE_KM = 100
const ZERO_SCORE_KM = 20000

export function scoreForDistance(distanceKm: number | null): number {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return 0
  const roundedKm = Math.round(distanceKm * 10) / 10
  if (roundedKm <= FULL_SCORE_KM) return MAX_SCORE
  if (roundedKm >= ZERO_SCORE_KM) return 0
  const span = ZERO_SCORE_KM - FULL_SCORE_KM
  const raw = (MAX_SCORE * (ZERO_SCORE_KM - roundedKm)) / span
  return Math.floor(Math.min(MAX_SCORE, Math.max(0, raw)))
}
