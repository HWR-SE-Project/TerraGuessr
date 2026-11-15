/**
 * Great-circle distance helpers (R09).
 *
 * Pure domain code: no I/O, no clock access, no randomness.
 */

/** WGS84 mean Earth radius in kilometres. */
export const EARTH_RADIUS_KM = 6371.0088;

/** A geographic coordinate in decimal degrees. */
export interface LatLon {
  /** Latitude in degrees, -90..90. */
  readonly lat: number;
  /** Longitude in degrees, -180..180. */
  readonly lon: number;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Haversine great-circle distance between two coordinates.
 *
 * @param a first coordinate
 * @param b second coordinate
 * @returns distance in kilometres (0 for identical coordinates)
 */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLon = Math.sin(dLon / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      sinHalfLon *
      sinHalfLon;

  // Math.min guard: floating-point round-off can push h marginally above 1,
  // which would make Math.sqrt(h) > 1 and Math.asin() return NaN.
  const centralAngle = 2 * Math.asin(Math.min(1, Math.sqrt(h)));

  return EARTH_RADIUS_KM * centralAngle;
}
