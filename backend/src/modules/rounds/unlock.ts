import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { GameNotFoundError } from '../../plugins/auth.js';
import type { RoundView } from '../../contracts/rounds.js';
import { getRoundView } from './service.js';

export class AdditionalDataUnlockError extends Error {
  readonly statusCode = 409;
  constructor(message: string) { super(message); this.name = 'AdditionalDataUnlockError'; }
}

/** Unlocks optional solar intelligence once, with server-authoritative rules. */
export async function unlockAdditionalData(roundId: string, db: PrismaClient, now = new Date()): Promise<RoundView> {
  const round = await db.round.findUnique({
    where: { id: roundId },
    select: {
      id: true, status: true, additionalDataAvailableAt: true, additionalDataUnlockedAt: true,
      game: { select: { additionalDataUnlockMode: true, additionalDataUnlockCost: true } },
    },
  });
  if (!round) throw new GameNotFoundError();
  if (round.status !== 'active') throw new AdditionalDataUnlockError('Additional data can only be unlocked during an active round');
  if (round.additionalDataUnlockedAt) return getRoundView(roundId, db);

  const mode = round.game.additionalDataUnlockMode;
  const cost = round.game.additionalDataUnlockCost;
  if (mode === 'time' && (!round.additionalDataAvailableAt || now < round.additionalDataAvailableAt)) {
    throw new AdditionalDataUnlockError('Additional data is not available yet');
  }
  if (mode === 'immediate') return getRoundView(roundId, db);

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Round" WHERE "id" = ${roundId} FOR UPDATE`;
      const current = await tx.round.findUnique({ where: { id: roundId }, select: { status: true, additionalDataUnlockedAt: true, additionalDataAvailableAt: true } });
      if (!current || current.status !== 'active') throw new AdditionalDataUnlockError('Additional data can only be unlocked during an active round');
      if (current.additionalDataUnlockedAt) return;
      if (mode === 'time' && (!current.additionalDataAvailableAt || now < current.additionalDataAvailableAt)) throw new AdditionalDataUnlockError('Additional data is not available yet');
      await tx.round.update({ where: { id: roundId }, data: {
        additionalDataUnlockedAt: now,
        additionalDataPointsSpent: mode === 'points' ? (cost ?? 0) : 0,
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new AdditionalDataUnlockError('Unlock changed concurrently; retry');
    throw error;
  }
  return getRoundView(roundId, db);
}
