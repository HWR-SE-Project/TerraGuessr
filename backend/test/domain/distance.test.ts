import { describe, expect, it } from 'vitest';

import { EARTH_RADIUS_KM, haversineKm } from '../../src/domain/distance.js';

const BERLIN = { lat: 52.52, lon: 13.405 } as const;
const PARIS = { lat: 48.8566, lon: 2.3522 } as const;

describe('haversineKm', () => {
  it('returns 0 km for identical coordinates', () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 0 })).toBe(0);
    expect(haversineKm(BERLIN, BERLIN)).toBe(0);
  });

  it('measures Berlin -> Paris at ~877 km (R09 vector)', () => {
    const distance = haversineKm(BERLIN, PARIS);

    // Reference value: 877.4645... km with R = 6371.0088.
    expect(distance).toBeGreaterThanOrEqual(876);
    expect(distance).toBeLessThanOrEqual(878);
    expect(distance).toBeCloseTo(877.4645, 3);
  });

  it('is symmetric', () => {
    const forward = haversineKm(BERLIN, PARIS);
    const backward = haversineKm(PARIS, BERLIN);

    expect(backward).toBeCloseTo(forward, 12);
  });

  it('uses the WGS84 mean Earth radius', () => {
    expect(EARTH_RADIUS_KM).toBe(6371.0088);
  });

  it('handles the antimeridian as the short way around, not 359.8° of longitude (R09)', () => {
    // 179.9°E and 179.9°W are 0.2° apart along the equator (~22 km), not the
    // ~19,975 km a naive |lonA - lonB| would produce without sine wraparound.
    const distance = haversineKm(
      { lat: 0, lon: 179.9 },
      { lat: 0, lon: -179.9 },
    );
    expect(distance).toBeCloseTo(22.24, 1);
    expect(distance).toBeLessThan(30);
  });

  it('measures a known long-haul pair: New York -> Tokyo at ~10,850 km (R09)', () => {
    const NEW_YORK = { lat: 40.7128, lon: -74.006 } as const;
    const TOKYO = { lat: 35.6762, lon: 139.6503 } as const;
    expect(haversineKm(NEW_YORK, TOKYO)).toBeCloseTo(10851, -1);
  });
});
