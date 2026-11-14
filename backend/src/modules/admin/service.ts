/**
 * Admin service (B-11). Operational endpoints only: re-running the pool seed
 * logic and warming the weather snapshot cache across the pool. These are
 * guarded upstream by the bearer-auth hook (ADR-0011) in routes.ts.
 *
 * The pool regeneration is intentionally separate from prisma/seed.ts: it is
 * the same deterministic sampling + upsert routine, made injectable so tests
 * can pass a small land fixture and seeded RNG.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { PrismaClient } from '@prisma/client';

import { sampleLandPoints } from '../locations/pool.js';
import type { LandGeoJson, Region, Rng } from '../locations/pool.js';
import { LocationsService } from '../locations/service.js';
import { getFreshSnapshot } from '../weather/cache.js';
import type { WeatherClient } from '../weather/types.js';

export const POOL_TARGET_POINTS = 2000;
export const POOL_RNG_SEED = 20261114;

/** A minimal logger surface used for the background refresh error path. */
export interface RefreshLogger {
  error(obj: unknown, message?: string): void;
}

/** Deterministic 32-bit PRNG (mulberry32) — matches prisma/seed.ts. */
function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stable identifier derived from the sampled coordinate (matches the seed so
 * re-runs are idempotent against the existing pool).
 */
function locationId(region: Region, lat: number, lon: number): string {
  const latKey = Math.round(lat * 10_000);
  const lonKey = Math.round(lon * 10_000);
  return 'grid_' + region.toLowerCase() + '_' + latKey + '_' + lonKey;
}

/** Read the vendored Natural Earth land GeoJSON used by the seed. */
export function loadLandGeoJson(): LandGeoJson {
  const landPath = new URL(
    '../../../prisma/data/ne_110m_land.json',
    import.meta.url,
  );
  const raw = readFileSync(landPath, 'utf8');
  return JSON.parse(raw) as LandGeoJson;
}

export interface RegenerateOptions {
  landGeoJson?: LandGeoJson;
  rng?: Rng;
  targetPoints?: number;
}

/**
 * Re-run the seed logic: rejection-sample land points and upsert Location
 * rows. Returns the number of locations written.
 */
export async function regeneratePool(
  db: PrismaClient,
  options: RegenerateOptions = {},
): Promise<number> {
  const landGeoJson = options.landGeoJson ?? loadLandGeoJson();
  const rng = options.rng ?? mulberry32(POOL_RNG_SEED);
  const targetPoints = options.targetPoints ?? POOL_TARGET_POINTS;

  const points = Array.from(sampleLandPoints(landGeoJson, targetPoints, rng));

  for (const point of points) {
    const id = locationId(point.region, point.lat, point.lon);
    await db.location.upsert({
      where: { id },
      create: {
        id,
        lat: point.lat,
        lon: point.lon,
        region: point.region,
        isLand: true,
        source: 'grid',
      },
      update: {
        lat: point.lat,
        lon: point.lon,
        region: point.region,
        isLand: true,
        source: 'grid',
      },
    });
  }

  return points.length;
}

export function createJobId(): string {
  return randomUUID();
}

export interface RefreshLocationsOptions extends RegenerateOptions {
  logger?: RefreshLogger;
}

/**
 * Start an asynchronous pool regeneration and return its tracking id
 * immediately (API-CONTRACTS.md §5 → 202 { jobId }). Failures are logged and
 * never leak into the HTTP response.
 */
export function refreshLocations(
  db: PrismaClient,
  options: RefreshLocationsOptions = {},
): { jobId: string } {
  const jobId = createJobId();

  void Promise.resolve()
    .then(() => regeneratePool(db, options))
    .catch((error: unknown) => {
      options.logger?.error({ err: error, jobId }, 'admin pool refresh failed');
    });

  return { jobId };
}

/**
 * Warm the WeatherSnapshot cache across the whole pool (architecture.md §6a).
 * Locations whose weather cannot be fetched are skipped (R13), never fatal.
 */
export async function warmWeatherCache(
  db: PrismaClient,
  weatherClient: WeatherClient,
): Promise<{ warmed: number }> {
  const locations = new LocationsService(db);
  const pool = await locations.listPool();

  let warmed = 0;
  for (const location of pool) {
    try {
      await getFreshSnapshot(db, weatherClient, location.id);
      warmed += 1;
    } catch {
      // Skip locations with unavailable weather; the pool remains usable via
      // the R13 fallback during normal round selection.
    }
  }

  return { warmed };
}