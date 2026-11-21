import type { LatLon } from '../api/types'

/**
 * Great-circle distance helpers (R09). Frontend-owned mirror of the backend's
 * pure domain code, kept byte-for-byte equivalent so the tutorial's example
 * math never drifts from the server's scoring.
 */

/** WGS84 mean Earth radius in kilometres. */
export const EARTH_RADIUS_KM = 6371.0088

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)

  const sinHalfLat = Math.sin(dLat / 2)
  const sinHalfLon = Math.sin(dLon / 2)

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      sinHalfLon *
      sinHalfLon

  // Math.min guard: floating-point round-off can push h marginally above 1,
  // which would make Math.sqrt(h) > 1 and Math.asin() return NaN.
  const centralAngle = 2 * Math.asin(Math.min(1, Math.sqrt(h)))

  return EARTH_RADIUS_KM * centralAngle
}
