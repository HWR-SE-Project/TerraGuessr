import { Prisma } from '@prisma/client';
import type { PrismaClient, Round, RoundAttempt } from '@prisma/client';
import { GameNotFoundError } from '../../plugins/auth.js';
import { haversineKm } from '../../domain/distance.js';
import { scoreForDistance } from '../../domain/scoring.js';
import type { SubmitGuessBody } from '../../contracts/results.js';
import { roundCap } from './service.js';

export class AttemptConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = 'Round is not accepting another attempt') { super(message); this.name = 'AttemptConflictError'; }
}

type AttemptRound = Round & { location: { lat: number; lon: number }; game: { id: string; roundsTotal: number; attemptsPerRound: number; mode: 'solo' | 'challenge' } };

async function finishFromAttempt(tx: Prisma.TransactionClient, round: AttemptRound, attempt: RoundAttempt) {
  const result = await tx.result.create({ data: {
    roundId: round.id,
    actualLat: round.location.lat,
    actualLon: round.location.lon,
    guessLat: attempt.guessLat,
    guessLon: attempt.guessLon,
    distanceKm: attempt.distanceKm,
    score: Math.max(0, attempt.score - round.additionalDataPointsSpent),
  } });
  await tx.guess.create({ data: { roundId: round.id, lat: attempt.guessLat, lon: attempt.guessLon } });
  await tx.round.update({ where: { id: round.id }, data: { status: 'completed', completedAt: new Date() } });
  if (round.roundNumber === roundCap(round.game.mode, round.game.roundsTotal)) {
    await tx.game.update({ where: { id: round.game.id }, data: { status: 'completed' } });
  }
  return { resultId: result.id, distanceKm: result.distanceKm, score: result.score, actual: { lat: round.location.lat, lon: round.location.lon } };
}

async function loadAttemptRound(db: PrismaClient, roundId: string): Promise<AttemptRound> {
  const round = await db.round.findUnique({ where: { id: roundId }, include: {
    location: { select: { lat: true, lon: true } },
    guess: true,
    game: { select: { id: true, mode: true, roundsTotal: true, attemptsPerRound: true } },
  } });
  if (!round) throw new GameNotFoundError();
  if (round.status !== 'active' || round.guess !== null || round.game.attemptsPerRound < 1) throw new AttemptConflictError();
  return round as AttemptRound;
}

export async function submitRoundAttempt(roundId: string, guess: SubmitGuessBody, db: PrismaClient) {
  const round = await loadAttemptRound(db, roundId);
  const distanceKm = haversineKm(guess, round.location);
  const score = scoreForDistance(distanceKm);
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Round" WHERE "id" = ${roundId} FOR UPDATE`;
      const current = await tx.round.findUnique({ where: { id: roundId }, select: { status: true, guess: { select: { id: true } } } });
      if (!current || current.status !== 'active' || current.guess) throw new AttemptConflictError();
      const attemptNumber = await tx.roundAttempt.count({ where: { roundId } }) + 1;
      if (attemptNumber > round.game.attemptsPerRound) throw new AttemptConflictError('Attempt limit reached');
      await tx.roundAttempt.create({ data: { roundId, attemptNumber, guessLat: guess.lat, guessLon: guess.lon, distanceKm, score } });
      const attemptsRemaining = round.game.attemptsPerRound - attemptNumber;
      if (attemptsRemaining > 0) return { attemptNumber, attemptsTotal: round.game.attemptsPerRound, attemptsRemaining, distanceKm, score: Math.max(0, score - round.additionalDataPointsSpent), result: null };
      const prior = await tx.roundAttempt.findMany({ where: { roundId }, orderBy: [{ score: 'desc' }, { distanceKm: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
      const best = prior[0];
      if (!best) throw new AttemptConflictError('No attempt is available to finish this round');
      const result = await finishFromAttempt(tx, round, best);
      return { attemptNumber, attemptsTotal: round.game.attemptsPerRound, attemptsRemaining: 0, distanceKm, score: Math.max(0, score - round.additionalDataPointsSpent), result };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) throw new AttemptConflictError('Another attempt was submitted at the same time; retry the action');
    throw error;
  }
}

export async function finishRoundAttempts(roundId: string, db: PrismaClient) {
  const round = await loadAttemptRound(db, roundId);
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Round" WHERE "id" = ${roundId} FOR UPDATE`;
      const current = await tx.round.findUnique({ where: { id: roundId }, select: { status: true, guess: { select: { id: true } } } });
      if (!current || current.status !== 'active' || current.guess) throw new AttemptConflictError();
      const attempts = await tx.roundAttempt.findMany({ where: { roundId }, orderBy: [{ score: 'desc' }, { distanceKm: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
      const best = attempts[0];
      if (!best) throw new AttemptConflictError('Submit at least one guess before finishing the round');
      return finishFromAttempt(tx, round, best);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) throw new AttemptConflictError();
    throw error;
  }
}
