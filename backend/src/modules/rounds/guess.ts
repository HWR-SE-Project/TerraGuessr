/**
 * Guess submission (B-07, R08/R09/R10/R11). Computes the distance/score for a
 * submitted guess and, in a single transaction, persists the Guess + Result,
 * completes the round and (for the final solo round) the game. The actual
 * location is revealed ONLY in the returned guess result (R11).
 */

import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

import { GameNotFoundError } from '../../plugins/auth.js';
import { haversineKm } from '../../domain/distance.js';
import { scoreForDistance } from '../../domain/scoring.js';
import { roundCap } from './service.js';
import type {
  GuessResultResponse,
  SubmitGuessBody,
} from '../../contracts/results.js';

/** 409 CONFLICT thrown for a second guess or a guess on a non-active round (R08). */
export class GuessConflictError extends Error {
  public readonly statusCode = 409;

  public constructor(
    message = 'Guess already submitted or round is not active',
  ) {
    super(message);
    this.name = 'GuessConflictError';
  }
}

/**
 * Submit a final guess for `roundId`. Ownership is enforced upstream by the
 * round-owner auth hook; this only resolves the round and guards its state.
 *
 * `rng` is accepted for signature symmetry with the other round workflows but
 * is unused here: the result id comes from Prisma's cuid and distance/score are
 * fully deterministic.
 */
export async function submitGuess(
  roundId: string,
  guess: SubmitGuessBody,
  db: PrismaClient,
  _rng?: () => number,
): Promise<GuessResultResponse> {
  const round = await db.round.findUnique({
    where: { id: roundId },
    include: {
      location: { select: { lat: true, lon: true } },
      guess: true,
      game: { select: { id: true, mode: true, roundsTotal: true, attemptsPerRound: true } },
    },
  });

  if (!round) {
    throw new GameNotFoundError();
  }

  // R08: exactly one guess per round. A completed round or an existing guess
  // both mean the guess can no longer be submitted.
  if (round.status !== 'active' || round.guess !== null) {
    throw new GuessConflictError();
  }

  if (round.game.attemptsPerRound > 1) {
    throw new GuessConflictError('This round requires the configured attempt workflow');
  }

  const actual = { lat: round.location.lat, lon: round.location.lon };
  const distanceKm = haversineKm(guess, actual);
  const grossScore = scoreForDistance(distanceKm);
  const score = Math.max(0, grossScore - round.additionalDataPointsSpent);
  const completedAt = new Date();
  const isFinalRound = round.roundNumber === roundCap(round.game.mode, round.game.roundsTotal);

  let created;
  try {
    created = await db.$transaction(async (tx) => {
      await tx.guess.create({
        data: { roundId, lat: guess.lat, lon: guess.lon },
      });

      const result = await tx.result.create({
        data: {
          roundId,
          actualLat: actual.lat,
          actualLon: actual.lon,
          guessLat: guess.lat,
          guessLon: guess.lon,
          distanceKm,
          score,
        },
      });

      await tx.round.update({
        where: { id: roundId },
        data: { status: 'completed', completedAt },
      });

      if (isFinalRound) {
        await tx.game.update({
          where: { id: round.game.id },
          data: { status: 'completed' },
        });
      }

      return result;
    });
  } catch (error) {
    // Phase C: two concurrent requests for the same round can both pass the
    // read-time check above before either commits. The loser hits Guess's
    // unique(roundId) constraint — surface the documented 409, not a raw
    // 500 from an unhandled unique-constraint violation.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new GuessConflictError();
    }
    throw error;
  }

  return {
    resultId: created.id,
    distanceKm: created.distanceKm,
    score: created.score,
    actual: { lat: created.actualLat, lon: created.actualLon },
  };
}
