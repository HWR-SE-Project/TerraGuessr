import { randomInt } from 'node:crypto';
import { ROAD_TARGETS } from './provider.js';

/**
 * Human-readable labels for `ROAD_TARGETS`, same index order. Every
 * coordinate is an unambiguous real-world city center, so this never
 * narrows or contradicts the actual target — it only names it (R07 list
 * mode for easy difficulty).
 */
export const ROAD_TARGET_NAMES = [
  'London',
  'Paris',
  'Rome',
  'Madrid',
  'Amsterdam',
  'Oslo',
  'Copenhagen',
  'Zürich',
  'Lisbon',
  'Prague',
  'Tokyo',
  'Seoul',
  'Singapore',
  'Bangkok',
  'Taipei',
  'Sydney',
  'Melbourne',
  'Auckland',
  'New York',
  'San Francisco',
  'Toronto',
  'Vancouver',
  'Mexico City',
  'Bogotá',
  'Buenos Aires',
  'Santiago',
  'São Paulo',
  'Cape Town',
  'Nairobi',
  'Lagos',
] as const;

const ROAD_TARGET_REGIONS = [
  'EUROPE',
  'EUROPE',
  'EUROPE',
  'EUROPE',
  'EUROPE',
  'EUROPE',
  'EUROPE',
  'EUROPE',
  'EUROPE',
  'EUROPE',
  'ASIA',
  'ASIA',
  'ASIA',
  'ASIA',
  'ASIA',
  'OCEANIA',
  'OCEANIA',
  'OCEANIA',
  'NORTH_AMERICA',
  'NORTH_AMERICA',
  'NORTH_AMERICA',
  'NORTH_AMERICA',
  'NORTH_AMERICA',
  'SOUTH_AMERICA',
  'SOUTH_AMERICA',
  'SOUTH_AMERICA',
  'SOUTH_AMERICA',
  'AFRICA',
  'AFRICA',
  'AFRICA',
] as const;

export interface CandidateOption {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
}

/** Actual target + 5 distractors (R07 list mode). */
const CANDIDATES_PER_ROUND = 6;

/**
 * Builds the easy-mode candidate list: the actual target plus distractors
 * drawn from the unused road-target pool, Fisher-Yates shuffled so the
 * answer's position never leaks which option is correct (R04).
 */
export function buildCandidates(
  targetIndex: number,
  usedIndices: number[],
): CandidateOption[] {
  const excluded = new Set([...usedIndices, targetIndex]);
  const pool = ROAD_TARGETS.map((_, i) => i).filter((i) => !excluded.has(i));
  const distractors: number[] = [];
  const count = Math.min(CANDIDATES_PER_ROUND - 1, pool.length);
  for (let i = 0; i < count; i++) {
    distractors.push(pool.splice(randomInt(pool.length), 1)[0]!);
  }
  const indices = [targetIndex, ...distractors];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices.map((index) => {
    const [lat, lon] = ROAD_TARGETS[index]!;
    return {
      id: String(index),
      name: ROAD_TARGET_NAMES[index]!,
      region: ROAD_TARGET_REGIONS[index]!,
      lat,
      lon,
    };
  });
}
