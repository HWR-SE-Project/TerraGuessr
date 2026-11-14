import { describe, expect, it } from 'vitest';

import {
  pointInPolygon,
  regionForLonLat,
  sampleLandPoints,
  REGIONS,
} from '../../src/modules/locations/pool.js';
import type {
  LandGeoJson,
  PolygonRing,
  Region,
} from '../../src/modules/locations/pool.js';

const square: PolygonRing = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

describe('pointInPolygon', () => {
  it('returns true for a point inside a small square', () => {
    expect(pointInPolygon(0, 0, square)).toBe(true);
  });

  it('returns false for points outside a small square', () => {
    expect(pointInPolygon(2, 2, square)).toBe(false);
    expect(pointInPolygon(-5, 3, square)).toBe(false);
  });
});

describe('regionForLonLat', () => {
  const cases: ReadonlyArray<readonly [number, number, Region]> = [
    [30, 20, 'AFRICA'],
    [48, 2, 'EUROPE'],
    [30, 100, 'ASIA'],
    [40, -100, 'NORTH_AMERICA'],
    [-15, -60, 'SOUTH_AMERICA'],
    [-25, 135, 'OCEANIA'],
  ];

  for (const [lat, lon, expected] of cases) {
    it('maps (' + lat + ', ' + lon + ') to ' + expected, () => {
      expect(regionForLonLat(lat, lon)).toBe(expected);
    });
  }
});

function squareRing(centerLon: number, centerLat: number, half = 0.5): number[][] {
  return [
    [centerLon - half, centerLat - half],
    [centerLon + half, centerLat - half],
    [centerLon + half, centerLat + half],
    [centerLon - half, centerLat + half],
    [centerLon - half, centerLat - half],
  ];
}

const fixture: LandGeoJson = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [squareRing(20, 0)] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [squareRing(10, 50)] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [squareRing(100, 30)] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [squareRing(-100, 40)] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [squareRing(-60, -15)] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [squareRing(135, -25)] } },
  ],
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('sampleLandPoints', () => {
  it('stratifies the sample equally across all six regions', () => {
    const count = 60;
    const points = Array.from(sampleLandPoints(fixture, count, mulberry32(42)));

    expect(points).toHaveLength(count);

    const perRegion = new Map<Region, number>();
    for (const point of points) {
      perRegion.set(point.region, (perRegion.get(point.region) ?? 0) + 1);
    }

    for (const region of REGIONS) {
      expect(perRegion.get(region)).toBe(10);
    }
  });

  it('emits only land points classified consistently with regionForLonLat', () => {
    const points = Array.from(sampleLandPoints(fixture, 120, mulberry32(7)));

    for (const point of points) {
      expect(regionForLonLat(point.lat, point.lon)).toBe(point.region);
      expect(point.lat).toBeGreaterThanOrEqual(-60);
    }
  });
});
