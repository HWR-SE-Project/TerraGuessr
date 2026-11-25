/**
 * Shared durable-result archiving (R18).
 *
 * Singleplayer and lobbies both upsert a `GameResult` row when a signed-in
 * player's round finalizes. The only differences are where the ids live
 * (`solo:<StreetRound.id>` vs `lobby:<LobbyRoundResult.id>`) and which
 * session/match ids they carry, so a single function owns the upsert.
 */

import type { Prisma } from '@prisma/client';
import type { Difficulty, GameMode } from '@prisma/client';

import type { LatLon } from './distance.js';

export interface ArchiveRoundInput {
  /** Deterministic id prefix: `solo:<roundId>` or `lobby:<resultId>`. */
  prefix: 'solo' | 'lobby';
  roundId: string;
  userId: string;
  mode: GameMode;
  difficulty: Difficulty;
  sessionId: string;
  matchId: string;
  roundNumber: number;
  actual: LatLon;
  /** The evaluated guess (closest submitted attempt, or timeout selection fallback; null if none). */
  evaluatedGuess: LatLon | null;
  distanceKm: number | null;
  score: number;
}

/**
 * Upsert a `GameResult` archive row. Called inside the same transaction that
 * locks the round score so a failed archive never leaves a completed round
 * permanently unarchived.
 */
export function archiveGameResult(
  tx: Prisma.TransactionClient,
  input: ArchiveRoundInput,
) {
  const id = `${input.prefix}:${input.roundId}`;
  return tx.gameResult.upsert({
    where: { id },
    create: {
      id,
      userId: input.userId,
      mode: input.mode,
      difficulty: input.difficulty,
      sessionId: input.sessionId,
      matchId: input.matchId,
      roundNumber: input.roundNumber,
      actualLat: input.actual.lat,
      actualLon: input.actual.lon,
      guessLat: input.evaluatedGuess?.lat ?? null,
      guessLon: input.evaluatedGuess?.lon ?? null,
      distanceKm: input.distanceKm,
      score: input.score,
    },
    update: {},
  });
}
