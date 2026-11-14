/**
 * Round selection core (R01/R02/R05/R07, ADR-0008).
 *
 * Pure domain code: no I/O, no clock access, no ambient randomness. The RNG
 * is injected so the selection is fully deterministic under test.
 */

import {
  EASY_CANDIDATES,
  MEDIUM_CANDIDATES,
  MIN_SEPARATION_KM,
  MAX_SELECTION_TRIES,
} from '../config/constants.js';

import { haversineKm } from './distance.js';

/** The six fixed world regions (ADR-0008). */
export const REGIONS = [
  'AFRICA',
  'EUROPE',
  'ASIA',
  'NORTH_AMERICA',
  'SOUTH_AMERICA',
  'OCEANIA',
] as const;

export type Region = (typeof REGIONS)[number];

export type Difficulty = 'easy' | 'medium' | 'hard';

/** How the player picks the location: choose from a list or place a map pin. */
export type SelectionMode = 'map' | 'list';

/** A function returning a uniformly distributed float in [0, 1). */
export type Rng = () => number;

/** A geographic coordinate in decimal degrees. */
export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

/** A single candidate location in the pool. */
export interface PoolItem extends LatLon {
  readonly id: string;
  readonly region: Region;
}

export interface SelectRoundOptions {
  readonly difficulty: Difficulty;
  readonly pool: readonly PoolItem[];
  /** Location ids already used by earlier rounds of this game. */
  readonly usedIds: ReadonlySet<string>;
  /** Coordinates of previous actuals in this game (empty for the first round). */
  readonly previousActuals?: readonly LatLon[];
  readonly rng: Rng;
  /**
   * Requested selection mode. Honored only for Medium (ADR-0008); Easy is
   * always 'list' and Hard is always 'map'.
   */
  readonly selectionMode?: SelectionMode;
}

export interface SelectionResult {
  readonly actual: PoolItem;
  /** Present only in list mode; empty for map mode. */
  readonly candidates: readonly PoolItem[];
  readonly selectionMode: SelectionMode;
}

export function resolveSelectionMode(
  difficulty: Difficulty,
  requested: SelectionMode | undefined,
): SelectionMode {
  if (difficulty === 'easy') return 'list';
  if (difficulty === 'hard') return 'map';
  return requested ?? 'list';
}

/** Uniformly sample an index into a non-empty array of the given length. */
function sampleIndex(length: number, rng: Rng): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

/** Uniformly sample one element from a non-empty array. */
function pickUniform<T>(items: readonly T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  return items[sampleIndex(items.length, rng)];
}

/** Fisher-Yates shuffle returning a fresh array. */
function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = current;
  }
  return copy;
}

/** True when the actual is at least MIN_SEPARATION_KM from every previous actual. */
function isSeparated(actual: LatLon, previous: readonly LatLon[]): boolean {
  return previous.every(
    (point) => haversineKm(actual, point) >= MIN_SEPARATION_KM,
  );
}

function pickActualEasy(
  pool: readonly PoolItem[],
  usedIds: ReadonlySet<string>,
  rng: Rng,
): PoolItem {
  const region = REGIONS[sampleIndex(REGIONS.length, rng)] as Region;
  const inRegion = pool.filter(
    (item) => item.region === region && !usedIds.has(item.id),
  );
  const actual = pickUniform(inRegion, rng);
  if (!actual) {
    throw new Error('No available location in region ' + region + ' for this round');
  }
  return actual;
}

function pickActualWorld(
  pool: readonly PoolItem[],
  usedIds: ReadonlySet<string>,
  previousActuals: readonly LatLon[],
  rng: Rng,
): PoolItem {
  const available = pool.filter((item) => !usedIds.has(item.id));
  if (available.length === 0) {
    throw new Error('No available location for this round');
  }

  // Make at most MAX_SELECTION_TRIES picks, accepting the first that is
  // MIN_SEPARATION_KM away from every previous actual; otherwise accept the
  // final pick (bounded, ADR-0008).
  let selected = pickUniform(available, rng) as PoolItem;
  for (
    let attempt = 1;
    attempt < MAX_SELECTION_TRIES && !isSeparated(selected, previousActuals);
    attempt += 1
  ) {
    selected = pickUniform(available, rng) as PoolItem;
  }

  return selected;
}

export function buildCandidates(
  difficulty: Difficulty,
  pool: readonly PoolItem[],
  usedIds: ReadonlySet<string>,
  actual: PoolItem,
  rng: Rng,
): readonly PoolItem[] {
  const target = difficulty === 'easy' ? EASY_CANDIDATES : MEDIUM_CANDIDATES;
  const scope =
    difficulty === 'easy'
      ? pool.filter((item) => item.region === actual.region)
      : pool;

  const distractorPool = scope.filter(
    (item) => item.id !== actual.id && !usedIds.has(item.id),
  );

  const distractors = shuffle(distractorPool, rng).slice(0, target - 1);
  return shuffle([actual, ...distractors], rng);
}

/**
 * Select the actual location and, in list mode, the distractor candidates for
 * one round. See ADR-0008 for the exact rules.
 */
export function selectRound(options: SelectRoundOptions): SelectionResult {
  const { difficulty, pool, usedIds, rng } = options;
  const previousActuals = options.previousActuals ?? [];
  const selectionMode = resolveSelectionMode(difficulty, options.selectionMode);

  const actual =
    difficulty === 'easy'
      ? pickActualEasy(pool, usedIds, rng)
      : pickActualWorld(pool, usedIds, previousActuals, rng);

  const candidates =
    selectionMode === 'list'
      ? buildCandidates(difficulty, pool, usedIds, actual, rng)
      : [];

  return { actual, candidates, selectionMode };
}
