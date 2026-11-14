/**
 * Results service (B-07). Lists a game's round results and fetches a single
 * result. Actual coordinates are NOT returned by these reads — they were
 * revealed at guess time (R11); results expose only score/distance/round.
 */

import type { PrismaClient } from '@prisma/client';

import { GameNotFoundError } from '../../plugins/auth.js';
import type { ResultListItem } from '../../contracts/results.js';

/** All results of a game, ordered by round number. */
export async function getGameResults(
  gameId: string,
  db: PrismaClient,
): Promise<ResultListItem[]> {
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

  const results: ResultListItem[] = [];
  for (const round of game.rounds) {
    const result = round.result;
    if (result !== null) {
      results.push({
        resultId: result.id,
        roundNumber: round.roundNumber,
        distanceKm: result.distanceKm,
        score: result.score,
      });
    }
  }

  return results;
}

/**
 * A single result by id. Ownership is enforced upstream by the result-owner
 * auth hook (ADR-0011).
 */
export async function getResult(
  resultId: string,
  db: PrismaClient,
): Promise<ResultListItem> {
  const result = await db.result.findUnique({
    where: { id: resultId },
    include: { round: { select: { roundNumber: true } } },
  });

  if (!result) {
    throw new GameNotFoundError();
  }

  return {
    resultId: result.id,
    roundNumber: result.round.roundNumber,
    distanceKm: result.distanceKm,
    score: result.score,
  };
}
