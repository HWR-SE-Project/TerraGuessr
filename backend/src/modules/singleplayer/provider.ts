import { randomInt } from 'node:crypto';
import type { LatLon } from '../../domain/distance.js';
import type { Biome } from '../../domain/scene.js';
import { LOCATION_CATALOG, type LocationEntry } from './locations.js';
import { PanoramaError } from './providerErrors.js';
export { PanoramaError } from './providerErrors.js';

/** Land target coordinates derived from the global biome catalog (R01). */
export const ROAD_TARGETS: readonly (readonly [number, number])[] =
  LOCATION_CATALOG.map((loc) => [loc.lat, loc.lon] as const);

export interface PanoramaTarget {
  /** Internal server-only identifier (never exposed to clients, R04). */
  panoId: string;
  targetIndex: number;
  lat: number;
  lon: number;
  biome?: Biome;
  placeName?: string;
}

export type PanoramaProvider = (used: number[]) => Promise<PanoramaTarget>;

/**
 * Selects a random unused land location from the curated global biome catalog
 * without requiring external street-imagery APIs or credentials (R01/R04/R19).
 */
export function catalogLocationProvider(
  catalog: readonly LocationEntry[] = LOCATION_CATALOG,
): PanoramaProvider {
  return async (used) => {
    const excluded = new Set(used);
    const candidates = catalog
      .map((_, index) => index)
      .filter((index) => !excluded.has(index));
    if (candidates.length === 0) {
      throw new PanoramaError(
        'No valid land locations remain available. Please retry.',
      );
    }
    const targetIndex = candidates[randomInt(candidates.length)]!;
    const entry = catalog[targetIndex]!;
    return {
      panoId: `loc:${targetIndex}`,
      targetIndex,
      lat: entry.lat,
      lon: entry.lon,
      biome: entry.biome,
      placeName: entry.name,
    };
  };
}

/**
 * Resolves a catalog target's coordinates purely server-side from the catalog
 * (or fallback coordinates when custom test providers supply synthetic IDs).
 */
export function catalogLocationLocator(
  catalog: readonly LocationEntry[] = LOCATION_CATALOG,
) {
  return async (panoId: string): Promise<LatLon> => {
    if (panoId.startsWith('loc:')) {
      const index = Number(panoId.slice(4));
      const entry = Number.isInteger(index) ? catalog[index] : undefined;
      if (entry) return { lat: entry.lat, lon: entry.lon };
    }
    throw new PanoramaError(
      'The location could not be resolved. Please retry.',
      'PANORAMA_UNAVAILABLE',
    );
  };
}
