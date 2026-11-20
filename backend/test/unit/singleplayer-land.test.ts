import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractLandPolygons,
  pointInPolygon,
} from '../../src/modules/locations/pool.js';
import type { LandGeoJson, LandPolygon } from '../../src/modules/locations/pool.js';
import { ROAD_TARGETS } from '../../src/modules/singleplayer/provider.js';

/**
 * R02 evidence: Street View singleplayer selects from a small curated pool of
 * real city roads (`ROAD_TARGETS`), which are land by construction. This
 * regression test makes that verifiable rather than merely asserted, reusing
 * the same point-in-polygon land-mask machinery the weather-game location
 * pool is validated with.
 */
function isOnLand(polygons: LandPolygon[], lat: number, lon: number): boolean {
  for (const polygon of polygons) {
    const { bbox } = polygon;
    if (
      lon < bbox.minLon ||
      lon > bbox.maxLon ||
      lat < bbox.minLat ||
      lat > bbox.maxLat
    )
      continue;
    if (!pointInPolygon(lat, lon, polygon.ring)) continue;
    if (polygon.holes.some((hole) => pointInPolygon(lat, lon, hole))) continue;
    return true;
  }
  return false;
}

describe('ROAD_TARGETS land/island validation (R02)', () => {
  const landPath = new URL(
    '../../prisma/data/ne_110m_land.json',
    import.meta.url,
  );
  const geo = JSON.parse(readFileSync(landPath, 'utf8')) as LandGeoJson;
  const polygons = extractLandPolygons(geo);

  it('loads a non-trivial land polygon set', () => {
    expect(polygons.length).toBeGreaterThan(50);
  });

  it.each(ROAD_TARGETS.map((target, index) => [index, ...target] as const))(
    'target %i (%s, %s) is on land, not open water',
    (_index, lat, lon) => {
      expect(isOnLand(polygons, lat, lon)).toBe(true);
    },
  );
});
