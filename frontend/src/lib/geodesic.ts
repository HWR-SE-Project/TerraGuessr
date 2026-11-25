import type { LatLon } from './contracts'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

/**
 * Generates great-circle arc segments between two coordinates, split across
 * the antimeridian so polylines take the shortest path on a flat Web Mercator
 * map instead of streaking across the full width of the world.
 */
export function greatCircleSegments(
  from: LatLon,
  to: LatLon,
  steps = 48,
): [number, number][][] {
  const lat1 = from.lat * DEG
  const lon1 = from.lon * DEG
  const lat2 = to.lat * DEG
  const lon2 = to.lon * DEG

  const x1 = Math.cos(lat1) * Math.cos(lon1)
  const y1 = Math.cos(lat1) * Math.sin(lon1)
  const z1 = Math.sin(lat1)

  const x2 = Math.cos(lat2) * Math.cos(lon2)
  const y2 = Math.cos(lat2) * Math.sin(lon2)
  const z2 = Math.sin(lat2)

  const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2))
  const omega = Math.acos(dot)
  if (!Number.isFinite(omega) || omega < 1e-6) {
    return [[[from.lat, from.lon], [to.lat, to.lon]]]
  }

  const sinOmega = Math.sin(omega)
  const segments: [number, number][][] = [[]]
  let prevLon: number | null = null

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = Math.sin((1 - t) * omega) / sinOmega
    const b = Math.sin(t * omega) / sinOmega
    const x = a * x1 + b * x2
    const y = a * y1 + b * y2
    const z = a * z1 + b * z2
    const lat = Math.atan2(z, Math.hypot(x, y)) * RAD
    const lon = Math.atan2(y, x) * RAD

    if (prevLon !== null && Math.abs(lon - prevLon) > 180) {
      segments.push([])
    }
    segments[segments.length - 1]!.push([lat, lon])
    prevLon = lon
  }

  return segments.filter((segment) => segment.length >= 2)
}

/** Normalize any Leaflet click longitude into [-180, 180] and clamp latitude. */
export function normalizeCoordinates(lat: number, lon: number): LatLon {
  const clampedLat = Math.max(-90, Math.min(90, lat))
  const wrappedLon = ((((lon + 180) % 360) + 360) % 360) - 180
  return { lat: clampedLat, lon: wrappedLon }
}
