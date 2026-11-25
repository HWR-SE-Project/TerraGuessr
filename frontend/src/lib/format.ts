// Small, dependency-free helpers shared across the app.

import type { LatLon } from './contracts'

export function formatCoordinates({ lat, lon }: LatLon): string {
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`
}

export function formatDistance(distanceKm: number | null): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return '—'
  const rounded = Math.round(Math.max(0, distanceKm) * 10) / 10
  return `${rounded.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
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

export function formatRegion(region: string): string {
  if (!region) return ''
  if (/^[A-Z0-9_]+$/.test(region)) {
    return region
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }
  return region.replaceAll('_', ' ')
}
