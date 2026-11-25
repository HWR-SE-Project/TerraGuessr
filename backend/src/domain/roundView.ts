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
import { evaluateGuess } from './scoring.js';
import { applyPointPenalty } from './roundFlow.js';

/** The minimal attempt shape both StreetRoundAttempt and LobbyRoundAttempt satisfy. */
export interface AttemptLike {
  score: number;
  distanceKm: number;
  createdAt: Date;
  id: string;
  guessLat: number;
  guessLon: number;
  attemptNumber: number;
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
  timedOut?: boolean;
}

export interface ScoreResult {
  guess: LatLon | null;
  distanceKm: number | null;
  score: number;
}

export interface EvaluatedAttemptView {
  attemptNumber: number;
  guess: LatLon;
  distanceKm: number;
  score: number;
  isBest: boolean;
}

/**
 * Project all submitted attempts for the post-round reveal (R11), marking the
 * winning Best-of-N attempt so the UI can highlight it alongside other bets.
 */
export function formatEvaluatedAttempts(
  attempts: readonly AttemptLike[],
): EvaluatedAttemptView[] {
  const winner = bestAttempt(attempts);
  return [...attempts]
    .sort((a, b) => a.attemptNumber - b.attemptNumber)
    .map((attempt) => ({
      attemptNumber: attempt.attemptNumber,
      guess: { lat: attempt.guessLat, lon: attempt.guessLon },
      distanceKm: attempt.distanceKm,
      score: attempt.score,
      isBest: winner !== null && attempt.id === winner.id,
    }));
}

/**
 * Unified Best-of-N scoring (R02/R08/R09/R10): whenever at least one attempt
 * was submitted, evaluate the closest submitted attempt — whether the round
 * ended by Final Submit, attempt exhaustion, or timeout. If no attempt was
 * submitted (e.g. a zero-attempt timeout), fall back to the saved selection.
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const attempt = bestAttempt(input.attempts);
  const guess = attempt ? { lat: attempt.guessLat, lon: attempt.guessLon } : input.selection;
  if (guess === null) return { guess, distanceKm: null, score: 0 };
  const { distanceKm, score } = evaluateGuess(guess, input.actual);
  return { guess, distanceKm, score: applyPointPenalty(score, input.pointsSpent) };
}
