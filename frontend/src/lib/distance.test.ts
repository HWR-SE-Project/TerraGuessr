import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS_KM, haversineKm } from './distance'

const BERLIN = { lat: 52.52, lon: 13.405 } as const
const PARIS = { lat: 48.8566, lon: 2.3522 } as const

describe('haversineKm (frontend parity)', () => {
  it('returns 0 km for identical coordinates', () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 0 })).toBe(0)
    expect(haversineKm(BERLIN, BERLIN)).toBe(0)
  })

  it('measures Berlin -> Paris at ~877 km (R09 vector)', () => {
    const distance = haversineKm(BERLIN, PARIS)
    expect(distance).toBeGreaterThanOrEqual(876)
    expect(distance).toBeLessThanOrEqual(878)
    expect(distance).toBeCloseTo(877.4645, 3)
  })

  it('is symmetric', () => {
    expect(haversineKm(PARIS, BERLIN)).toBeCloseTo(haversineKm(BERLIN, PARIS), 12)
  })

  it('uses the WGS84 mean Earth radius', () => {
    expect(EARTH_RADIUS_KM).toBe(6371.0088)
  })

  it('handles the antimeridian as the short way around', () => {
    const distance = haversineKm({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 })
    expect(distance).toBeCloseTo(22.24, 1)
    expect(distance).toBeLessThan(30)
  })

  it('measures New York -> Tokyo at ~10,850 km', () => {
    const distance = haversineKm({ lat: 40.7128, lon: -74.006 }, { lat: 35.6762, lon: 139.6503 })
    expect(distance).toBeCloseTo(10851, -1)
  })
})
