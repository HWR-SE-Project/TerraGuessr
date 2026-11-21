/**
 * Shared round projection and scoring helpers (R02/R05/R09/R10).
 *
 * The singleplayer and lobby flows used to carry near-identical copies of
 * `bestAttempt`, `extraDataAccess` and the "best attempt → selection → distance
 * → score → point penalty" pipeline. That meant every round-attribute change
 * (a streak bonus, a new extra-data mode, a timed-round flag) had to touch both
 * modules or silently diverge. These are the mode-agnostic pieces; the two
 * services keep only the storage-specific glue (how they read attempts and the
 * per-player state).
 */

import type { GameRules } from './gameRules.js';
import type { LatLon } from './distance.js';
import { haversineKm } from './distance.js';
import { scoreForDistance } from './scoring.js';
import { applyPointPenalty } from './roundFlow.js';

/** The minimal attempt shape both StreetRoundAttempt and LobbyRoundAttempt satisfy. */
export interface AttemptLike {
  score: number;
  distanceKm: number;
  createdAt: Date;
  id: string;
  guessLat: number;
  guessLon: number;
}

/** The best submitted attempt: highest score, then smallest distance, then earliest. */
export function bestAttempt<T extends AttemptLike>(
  attempts: readonly T[],
): T | null {
  return (
    [...attempts].sort(
      (a, b) =>
        b.score - a.score ||
        a.distanceKm - b.distanceKm ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    )[0] ?? null
  );
}

/** Per-round additional-data state, normalized across singleplayer and lobbies. */
export interface ExtraDataState {
  unlockedAt: Date | null;
  pointsSpent: number;
}

/** R05 additional-data access view (free mode reads as immediate, never costs). */
export function extraDataAccess(
  state: ExtraDataState,
  rules: GameRules,
) {
  const unlocked = rules.extraData.mode === 'free' || state.unlockedAt !== null;
  return {
    mode:
      rules.extraData.mode === 'free'
        ? ('immediate' as const)
        : rules.extraData.mode,
    cost: rules.extraData.mode === 'free' ? null : rules.extraData.cost,
    availableAt: null,
    unlocked,
    pointsSpent: state.pointsSpent,
  };
}

export interface ScoreInput {
  attempts: readonly AttemptLike[];
  selection: LatLon | null;
  actual: LatLon;
  pointsSpent: number;
}

export interface ScoreResult {
  guess: LatLon | null;
  distanceKm: number | null;
  score: number;
}

/**
 * R09/R10 scoring for a finalized round: the best attempt wins, otherwise the
 * latest selection is used, then distance → raw score → point penalty.
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const best = bestAttempt(input.attempts);
  const guess =
    best !== null
      ? { lat: best.guessLat, lon: best.guessLon }
      : input.selection;
  const distanceKm = guess === null ? null : haversineKm(guess, input.actual);
  const rawScore = distanceKm === null ? 0 : scoreForDistance(distanceKm);
  const score = applyPointPenalty(rawScore, input.pointsSpent);
  return { guess, distanceKm, score };
}
