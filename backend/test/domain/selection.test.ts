import { describe, expect, it } from 'vitest';

import {
  EASY_CANDIDATES,
  MEDIUM_CANDIDATES,
  MAX_SELECTION_TRIES,
} from '../../src/config/constants.js';
import { selectRound } from '../../src/domain/selection.js';
import type { LatLon, PoolItem } from '../../src/domain/selection.js';

/** Deterministic 32-bit PRNG, matching the seedable RNG used elsewhere. */
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

/** An RNG that replays a fixed sequence and then sticks to the last value. */
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    if (index < values.length - 1) index += 1;
    return value ?? 0;
  };
}

/** An RNG that replays a fixed sequence and counts how many times it is called. */
function countingRng(values: number[]): { rng: () => number; calls: () => number } {
  let index = 0;
  let calls = 0;
  const rng = () => {
    calls += 1;
    const value = values[Math.min(index, values.length - 1)];
    if (index < values.length - 1) index += 1;
    return value ?? 0;
  };
  return { rng, calls: () => calls };
}

const POOL: readonly PoolItem[] = [
  { id: 'eu-1', lat: 51.5074, lon: -0.1278, region: 'EUROPE' },
  { id: 'eu-2', lat: 48.8566, lon: 2.3522, region: 'EUROPE' },
  { id: 'eu-3', lat: 52.52, lon: 13.405, region: 'EUROPE' },
  { id: 'eu-4', lat: 40.4168, lon: -3.7038, region: 'EUROPE' },
  { id: 'eu-5', lat: 41.9028, lon: 12.4964, region: 'EUROPE' },
  { id: 'eu-6', lat: 50.4501, lon: 30.5234, region: 'EUROPE' },

  { id: 'as-1', lat: 35.6762, lon: 139.6503, region: 'ASIA' },
  { id: 'as-2', lat: 39.9042, lon: 116.4074, region: 'ASIA' },
  { id: 'as-3', lat: 28.6139, lon: 77.209, region: 'ASIA' },
  { id: 'as-4', lat: 13.7563, lon: 100.5018, region: 'ASIA' },
  { id: 'as-5', lat: 1.3521, lon: 103.8198, region: 'ASIA' },
  { id: 'as-6', lat: 25.2048, lon: 55.2708, region: 'ASIA' },

  { id: 'af-1', lat: 30.0444, lon: 31.2357, region: 'AFRICA' },
  { id: 'af-2', lat: 6.5244, lon: 3.3792, region: 'AFRICA' },
  { id: 'af-3', lat: -1.2921, lon: 36.8219, region: 'AFRICA' },
  { id: 'af-4', lat: -26.2041, lon: 28.0473, region: 'AFRICA' },
  { id: 'af-5', lat: 33.5731, lon: -7.5898, region: 'AFRICA' },
  { id: 'af-6', lat: 5.6037, lon: -0.187, region: 'AFRICA' },

  { id: 'na-1', lat: 40.7128, lon: -74.006, region: 'NORTH_AMERICA' },
  { id: 'na-2', lat: 43.6532, lon: -79.3832, region: 'NORTH_AMERICA' },
  { id: 'na-3', lat: 19.4326, lon: -99.1332, region: 'NORTH_AMERICA' },
  { id: 'na-4', lat: 34.0522, lon: -118.2437, region: 'NORTH_AMERICA' },
  { id: 'na-5', lat: 41.8781, lon: -87.6298, region: 'NORTH_AMERICA' },
  { id: 'na-6', lat: 49.2827, lon: -123.1207, region: 'NORTH_AMERICA' },

  { id: 'sa-1', lat: -23.5505, lon: -46.6333, region: 'SOUTH_AMERICA' },
  { id: 'sa-2', lat: -34.6037, lon: -58.3816, region: 'SOUTH_AMERICA' },
  { id: 'sa-3', lat: -12.0464, lon: -77.0428, region: 'SOUTH_AMERICA' },
  { id: 'sa-4', lat: 4.711, lon: -74.0721, region: 'SOUTH_AMERICA' },
  { id: 'sa-5', lat: -33.4489, lon: -70.6693, region: 'SOUTH_AMERICA' },
  { id: 'sa-6', lat: -22.9068, lon: -43.1729, region: 'SOUTH_AMERICA' },

  { id: 'oc-1', lat: -33.8688, lon: 151.2093, region: 'OCEANIA' },
  { id: 'oc-2', lat: -37.8136, lon: 144.9631, region: 'OCEANIA' },
  { id: 'oc-3', lat: -36.8509, lon: 174.7645, region: 'OCEANIA' },
  { id: 'oc-4', lat: -31.9505, lon: 115.8605, region: 'OCEANIA' },
  { id: 'oc-5', lat: -27.4698, lon: 153.0251, region: 'OCEANIA' },
  { id: 'oc-6', lat: -41.2866, lon: 174.7756, region: 'OCEANIA' },
];

function candidateIds(result: { candidates: readonly PoolItem[] }): string[] {
  return result.candidates.map((item) => item.id);
}

describe('selectRound — Easy', () => {
  it('always selects list mode and returns exactly EASY_CANDIDATES candidates', () => {
    const result = selectRound({
      difficulty: 'easy',
      pool: POOL,
      usedIds: new Set(),
      rng: mulberry32(1234),
    });

    expect(result.selectionMode).toBe('list');
    expect(result.candidates).toHaveLength(EASY_CANDIDATES);
  });

  it('picks actual and all candidates from one single region', () => {
    const result = selectRound({
      difficulty: 'easy',
      pool: POOL,
      usedIds: new Set(),
      rng: mulberry32(5678),
    });

    const region = result.actual.region;
    for (const candidate of result.candidates) {
      expect(candidate.region).toBe(region);
    }
  });

  it('always includes the actual among the candidates', () => {
    const result = selectRound({
      difficulty: 'easy',
      pool: POOL,
      usedIds: new Set(),
      rng: mulberry32(9),
    });

    expect(candidateIds(result)).toContain(result.actual.id);
  });

  it('returns distinct candidates', () => {
    const result = selectRound({
      difficulty: 'easy',
      pool: POOL,
      usedIds: new Set(),
      rng: mulberry32(11),
    });

    const ids = candidateIds(result);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ignores a requested map mode and forces list', () => {
    const result = selectRound({
      difficulty: 'easy',
      pool: POOL,
      usedIds: new Set(),
      selectionMode: 'map',
      rng: mulberry32(13),
    });

    expect(result.selectionMode).toBe('list');
    expect(result.candidates).toHaveLength(EASY_CANDIDATES);
  });
});

describe('selectRound — Medium', () => {
  it('defaults to list mode and returns exactly MEDIUM_CANDIDATES candidates', () => {
    const result = selectRound({
      difficulty: 'medium',
      pool: POOL,
      usedIds: new Set(),
      rng: mulberry32(99),
    });

    expect(result.selectionMode).toBe('list');
    expect(result.candidates).toHaveLength(MEDIUM_CANDIDATES);
  });

  it('always includes the actual among the candidates', () => {
    const result = selectRound({
      difficulty: 'medium',
      pool: POOL,
      usedIds: new Set(),
      rng: mulberry32(101),
    });

    expect(candidateIds(result)).toContain(result.actual.id);
  });

  it('returns distinct candidates', () => {
    const result = selectRound({
      difficulty: 'medium',
      pool: POOL,
      usedIds: new Set(),
      rng: mulberry32(103),
    });

    const ids = candidateIds(result);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('honors a requested map mode and returns no candidates', () => {
    const result = selectRound({
      difficulty: 'medium',
      pool: POOL,
      usedIds: new Set(),
      selectionMode: 'map',
      rng: mulberry32(105),
    });

    expect(result.selectionMode).toBe('map');
    expect(result.candidates).toHaveLength(0);
  });
});

describe('selectRound — Hard', () => {
  it('forces map mode and returns no candidates', () => {
    const result = selectRound({
      difficulty: 'hard',
      pool: POOL,
      usedIds: new Set(),
      rng: mulberry32(2),
    });

    expect(result.selectionMode).toBe('map');
    expect(result.candidates).toHaveLength(0);
  });

  it('ignores a requested list mode and forces map', () => {
    const result = selectRound({
      difficulty: 'hard',
      pool: POOL,
      usedIds: new Set(),
      selectionMode: 'list',
      rng: mulberry32(4),
    });

    expect(result.selectionMode).toBe('map');
    expect(result.candidates).toHaveLength(0);
  });
});

describe('selectRound — no-repeat and diversity', () => {
  it('never selects a used location id (Medium, whole pool)', () => {
    const pool = POOL.slice(0, 6);
    const usedIds = new Set(pool.slice(0, 5).map((item) => item.id));
    const remaining = pool[5]!;

    const result = selectRound({
      difficulty: 'medium',
      pool,
      usedIds,
      selectionMode: 'map',
      rng: mulberry32(5),
    });

    expect(result.actual.id).toBe(remaining.id);
  });

  it('never reuses a used location id as actual or candidate (Medium, list)', () => {
    const pool = POOL.slice(0, 8);
    const usedIds = new Set([pool[0]!.id, pool[1]!.id]);

    const result = selectRound({
      difficulty: 'medium',
      pool,
      usedIds,
      rng: mulberry32(7),
    });

    expect(usedIds.has(result.actual.id)).toBe(false);
    for (const candidate of result.candidates) {
      expect(usedIds.has(candidate.id)).toBe(false);
    }
    expect(candidateIds(result)).toContain(result.actual.id);
  });

  it('resamples an actual that is too close to a previous actual (Hard)', () => {
    const previous: LatLon = { lat: 40, lon: -100 };
    const close: PoolItem = { id: 'close', lat: 41, lon: -100, region: 'NORTH_AMERICA' };
    const far: PoolItem = { id: 'far', lat: 40, lon: -80, region: 'NORTH_AMERICA' };

    const result = selectRound({
      difficulty: 'hard',
      pool: [close, far],
      usedIds: new Set(),
      previousActuals: [previous],
      rng: sequence(0.1, 0.9),
    });

    expect(result.actual.id).toBe('far');
  });

  it('accepts the last pick after MAX_SELECTION_TRIES when no far location exists', () => {
    const previous: LatLon = { lat: 40, lon: -100 };
    const close1: PoolItem = { id: 'c1', lat: 41, lon: -100, region: 'NORTH_AMERICA' };
    const close2: PoolItem = { id: 'c2', lat: 42, lon: -100, region: 'NORTH_AMERICA' };

    const { rng, calls } = countingRng([0.0]);
    const result = selectRound({
      difficulty: 'hard',
      pool: [close1, close2],
      usedIds: new Set(),
      previousActuals: [previous],
      rng,
    });

    expect(calls()).toBe(MAX_SELECTION_TRIES);
    expect(result.actual.id).toBe('c1');
  });
});
