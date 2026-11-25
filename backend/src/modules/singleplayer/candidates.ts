import { randomInt, randomUUID } from 'node:crypto';
import type { LatLon } from '../../domain/distance.js';
import { AppError } from '../../plugins/errors.js';
import { LOCATION_CATALOG } from './locations.js';

export const ROAD_TARGET_NAMES = LOCATION_CATALOG.map((loc) => loc.name);

/** Server-side stored candidate record (coordinates stay server-only, R04). */
export interface CandidateOption {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
}

/** Public candidate view sent to the client during an active Easy round (R04/R05). */
export interface PublicCandidate {
  id: string;
  name: string;
  region: string;
}

export type GuessOrSelectionInput =
  | { lat: number; lon: number }
  | { candidateId: string };

/** Actual target + 5 distractors (R05/R07 list mode). */
const CANDIDATES_PER_ROUND = 6;
/** Prefer some same-biome distractors so the 3D biome diorama never reveals the Easy answer (R04). */
const PREFERRED_SAME_BIOME_DISTRACTORS = 3;

function drawRandom(pool: number[], count: number): number[] {
  const picked: number[] = [];
  const limit = Math.min(count, pool.length);
  for (let i = 0; i < limit; i++) {
    picked.push(pool.splice(randomInt(pool.length), 1)[0]!);
  }
  return picked;
}

/** Strip coordinates before projecting Easy candidates to the client (R04). */
export function toPublicCandidates(
  candidates: CandidateOption[] | null | undefined,
): PublicCandidate[] | undefined {
  if (!candidates || candidates.length === 0) return undefined;
  return candidates.map(({ id, name, region }) => ({ id, name, region }));
}

/** Match a server-stored selection back to its round-scoped candidate choice. */
export function findCandidateByPoint(
  candidates: CandidateOption[] | null | undefined,
  lat: number | null,
  lon: number | null,
): CandidateOption | null {
  if (!candidates || lat === null || lon === null) return null;
  return candidates.find((candidate) => candidate.lat === lat && candidate.lon === lon) ?? null;
}

/**
 * Validate and resolve a client selection/guess against the round's mode (R04/R05).
 * List mode requires a round-scoped `candidateId` present in `candidates`; map mode
 * requires explicit `{ lat, lon }` coordinates.
 */
export function resolveSelectionPoint(
  selectionMode: 'list' | 'map',
  input: GuessOrSelectionInput,
  candidates: CandidateOption[] | null | undefined,
): LatLon {
  if (selectionMode === 'list') {
    if (!('candidateId' in input)) {
      throw new AppError(400, 'Easy mode requires selecting one of the round’s cities.');
    }
    const match = candidates?.find((candidate) => candidate.id === input.candidateId);
    if (!match) {
      throw new AppError(400, 'Selected city is not one of the choices for this round.');
    }
    return { lat: match.lat, lon: match.lon };
  }
  if ('candidateId' in input) {
    throw new AppError(400, 'Map mode requires latitude and longitude coordinates.');
  }
  return { lat: input.lat, lon: input.lon };
}

/**
 * Builds the easy-mode candidate list: the actual target plus 5 distinct
 * distractors. Prefers unused catalog entries (balancing same-biome and
 * cross-biome entries), then backfills from previously used entries after
 * endless-mode catalog exhaustion so Easy ALWAYS offers 6 distinct choices
 * (R04/R05). Uses opaque round-scoped IDs and Fisher-Yates shuffling.
 */
export function buildCandidates(
  targetIndex: number,
  usedIndices: number[],
): CandidateOption[] {
  const target = LOCATION_CATALOG[targetIndex];
  const used = new Set(usedIndices);
  const unusedSameBiome: number[] = [];
  const unusedOtherBiome: number[] = [];
  const usedSameBiome: number[] = [];
  const usedOtherBiome: number[] = [];

  for (let i = 0; i < LOCATION_CATALOG.length; i++) {
    if (i === targetIndex) continue;
    const sameBiome = Boolean(target && LOCATION_CATALOG[i]!.biome === target.biome);
    if (used.has(i)) {
      (sameBiome ? usedSameBiome : usedOtherBiome).push(i);
    } else {
      (sameBiome ? unusedSameBiome : unusedOtherBiome).push(i);
    }
  }

  const needed = CANDIDATES_PER_ROUND - 1;
  const picked: number[] = [];

  picked.push(...drawRandom(unusedSameBiome, PREFERRED_SAME_BIOME_DISTRACTORS));
  picked.push(...drawRandom(unusedOtherBiome, needed - picked.length));
  if (picked.length < needed) {
    picked.push(...drawRandom(unusedSameBiome, needed - picked.length));
  }
  if (picked.length < needed) {
    const sameCount = picked.filter(
      (i) => target && LOCATION_CATALOG[i]!.biome === target.biome,
    ).length;
    const sameWanted = Math.max(0, PREFERRED_SAME_BIOME_DISTRACTORS - sameCount);
    if (sameWanted > 0) {
      picked.push(...drawRandom(usedSameBiome, Math.min(sameWanted, needed - picked.length)));
    }
    if (picked.length < needed) {
      picked.push(...drawRandom(usedOtherBiome, needed - picked.length));
    }
    if (picked.length < needed) {
      picked.push(...drawRandom(usedSameBiome, needed - picked.length));
    }
  }

  const indices = [targetIndex, ...picked];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }

  return indices.map((index) => {
    const entry = LOCATION_CATALOG[index]!;
    return {
      id: randomUUID(),
      name: entry.name,
      region: entry.region,
      lat: entry.lat,
      lon: entry.lon,
    };
  });
}
