/**
 * Shared round rules for every game mode (R02/R05/R16).
 *
 * Difficulty is a property of the game, not of "solo" or "lobby": the same
 * time limit, attempt budget, selection mode and extra-data cost must apply
 * everywhere. Keep this pure and dependency-free so backend services and tests
 * can share one source of truth.
 */

export type GameDifficulty = 'easy' | 'medium' | 'hard';

/** R05: additional clues are free, cost points, or cost time. */
export type ExtraDataPolicy =
  | { mode: 'free' }
  | { mode: 'points'; cost: number }
  | { mode: 'time'; cost: number };

export interface GameRules {
  /** R05 round time limit in seconds. */
  timeLimitSeconds: number;
  /** R05 available guess attempts. */
  attemptsPerRound: number;
  /** R05/R07 location-selection mode. */
  selectionMode: 'list' | 'map';
  /** R05: both Medium and Hard use a map with country borders. */
  countryBorders: boolean;
  /** R05: unlocking further weather metrics or hints. */
  extraData: ExtraDataPolicy;
}

const RULES: Record<GameDifficulty, GameRules> = {
  easy: {
    timeLimitSeconds: 7 * 60,
    attemptsPerRound: 3,
    selectionMode: 'list',
    countryBorders: true,
    extraData: { mode: 'free' },
  },
  medium: {
    timeLimitSeconds: 4 * 60,
    attemptsPerRound: 2,
    selectionMode: 'map',
    countryBorders: true,
    extraData: { mode: 'points', cost: 100 },
  },
  hard: {
    timeLimitSeconds: 2 * 60,
    attemptsPerRound: 1,
    selectionMode: 'map',
    countryBorders: true,
    extraData: { mode: 'time', cost: 20 },
  },
};

/** Return the shared rules for a difficulty level. Unknown values fall back to medium. */
export function gameRulesFor(difficulty: string | null | undefined): GameRules {
  if (difficulty === 'easy' || difficulty === 'hard') return RULES[difficulty];
  return RULES.medium;
}
