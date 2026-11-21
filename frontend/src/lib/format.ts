import type { LatLon } from '../api/types'

/**
 * Shared gameplay formatters used by both singleplayer and multiplayer.
 * Keeping these in one place ensures the two modes render distances, timers
 * and coordinates identically (R09/R15) instead of drifting apart.
 */

/** R09: distance in kilometres, rounded to one decimal place. */
export function distanceLabel(km: number | null): string {
  if (km === null) return 'No guess submitted'
  return `${km.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`
}

/** Countdown label in `m:ss`, or an em dash when there is no timer. */
export function clockLabel(seconds: number | null): string {
  if (seconds === null) return '—'
  const safe = Math.max(0, seconds)
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

/** Whole seconds between `now` and an ISO deadline, floored at 0, or null without one. */
export function secondsUntil(deadline: string | null | undefined, now: number): number | null {
  return deadline == null ? null : Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000))
}

/** Latitude/longitude in compact degrees notation. */
export function coordinates(point: LatLon | null): string {
  if (!point) return 'No guess submitted'
  return `${Math.abs(point.lat).toFixed(3)}° ${point.lat >= 0 ? 'N' : 'S'}, ${Math.abs(point.lon).toFixed(3)}° ${point.lon >= 0 ? 'E' : 'W'}`
}
