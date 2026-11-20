/**
 * Lobby difficulty rules (R5, R16). Difficulty changes the round conditions,
 * not the lobby shape: the host picks one level and every player inherits it.
 * Pure and dependency-free so the same mapping backs the API and unit tests.
 */

export type LobbyDifficulty = 'easy' | 'medium' | 'hard';

export interface LobbyRules {
  /** R5 time limit for the round. */
  timeLimitSeconds: number;
  /** R5 available guess attempts. */
  attemptsPerRound: number;
  /** R5 location-selection mode. */
  selectionMode: 'list' | 'map';
}

const RULES: Record<LobbyDifficulty, LobbyRules> = {
  easy: { timeLimitSeconds: 7 * 60, attemptsPerRound: 3, selectionMode: 'list' },
  medium: { timeLimitSeconds: 4 * 60, attemptsPerRound: 2, selectionMode: 'map' },
  hard: { timeLimitSeconds: 2 * 60, attemptsPerRound: 1, selectionMode: 'map' },
};

/** Return the R5 rules for a lobby difficulty. */
export function lobbyRulesFor(difficulty: LobbyDifficulty): LobbyRules {
  return RULES[difficulty];
}
