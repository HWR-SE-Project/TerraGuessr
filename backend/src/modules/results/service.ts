/**
 * Results service (B-07). Lists a game's round results and fetches a single
 * result, returning the full ResultDTO per API-CONTRACTS.md §3.
 */

import type { PrismaClient } from '@prisma/client';

import { GameNotFoundError } from '../../plugins/auth.js';
import type { GameResultsResponse, ResultDTO } from '../../contracts/results.js';

/** Map a persisted result (+ round) to the API ResultDTO. */
function toResultDTO(
  result: {
    id: string;
    distanceKm: number;
    score: number;
    actualLat: number;
    actualLon: number;
    guessLat: number;
    guessLon: number;
    createdAt: Date;
  },
  roundNumber: number,
): ResultDTO {
  return {
    resultId: result.id,
    roundNumber,
    distanceKm: result.distanceKm,
    score: result.score,
    actual: { lat: result.actualLat, lon: result.actualLon },
    guess: { lat: result.guessLat, lon: result.guessLon },
    createdAt: result.createdAt.toISOString(),
  };
}

/** All results of a game, ordered by round number, with the total score. */
export async function getGameResults(
  gameId: string,
  db: PrismaClient,
): Promise<GameResultsResponse> {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: { result: true },
      },
    },
  });

  if (!game) {
    throw new GameNotFoundError();
  }

  const results: ResultDTO[] = [];
  let totalScore = 0;
  for (const round of game.rounds) {
    const result = round.result;
    if (result !== null) {
      results.push(toResultDTO(result, round.roundNumber));
      totalScore += result.score;
    }
  }

  return { results, totalScore };
}

/** A single result by id. Ownership enforced upstream (ADR-0011). */
export async function getResult(
  resultId: string,
  db: PrismaClient,
): Promise<ResultDTO> {
  const result = await db.result.findUnique({
    where: { id: resultId },
    include: { round: { select: { roundNumber: true } } },
  });

  if (!result) {
    throw new GameNotFoundError();
  }

  return toResultDTO(result, result.round.roundNumber);
}
