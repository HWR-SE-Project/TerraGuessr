import { readFileSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';

import { sampleLandPoints } from '../src/modules/locations/pool.js';
import type { LandGeoJson, Region } from '../src/modules/locations/pool.js';

const TARGET_POINTS = 2000;
const RNG_SEED = 20261114;

/** Deterministic 32-bit PRNG (mulberry32) so re-runs sample identical points. */
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

/**
 * Stable identifier derived from the sampled coordinate. The schema has no
 * unique constraint on (lat, lon), so the upsert is keyed on this deterministic
 * id to make re-runs idempotent without schema changes.
 */
function locationId(region: Region, lat: number, lon: number): string {
  const latKey = Math.round(lat * 10_000);
  const lonKey = Math.round(lon * 10_000);
  return 'grid_' + region.toLowerCase() + '_' + latKey + '_' + lonKey;
}

async function main(): Promise<void> {
  const landPath = new URL('./data/ne_110m_land.json', import.meta.url);
  const raw = readFileSync(landPath, 'utf8');
  const landGeoJson = JSON.parse(raw) as LandGeoJson;

  const points = Array.from(
    sampleLandPoints(landGeoJson, TARGET_POINTS, mulberry32(RNG_SEED)),
  );

  const prisma = new PrismaClient();
  try {
    for (const point of points) {
      const id = locationId(point.region, point.lat, point.lon);
      await prisma.location.upsert({
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

    process.stdout.write(
      'Seeded ' + points.length + ' land locations (target ' + TARGET_POINTS + ').',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write('seed failed: ' + String(error));
  process.exitCode = 1;
});
