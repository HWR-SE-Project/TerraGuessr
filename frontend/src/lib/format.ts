// Small, dependency-free helpers shared across the app.

const EARTH_RADIUS_KM = 6371

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
const MAX_SCORE = 5000
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

export function formatDistance(distanceKm: number | null): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return '—'
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`
  if (distanceKm < 1000) return `${distanceKm.toFixed(0)} km`
  return `${(distanceKm / 1000).toFixed(1)}k km`
}

export function formatScore(score: number): string {
  return score.toLocaleString('en-US')
}

export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)}%`
}

export function formatCountdown(secondsLeft: number): string {
  return `${Math.max(0, Math.ceil(secondsLeft))}s`
}

export function initials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Deterministic pastel-ish colour from a string (for avatars/participants). */
export function hueFromString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return Math.abs(hash) % 360
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
