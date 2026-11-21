/**
 * Retention purge (B-09, R18 — architecture.md §7a, decision B.6).
 *
 * Completed rounds for signed-in players are archived in `GameResult`, a flat
 * record with no relations/cascades (schema.prisma note). A single batched
 * delete is therefore sufficient.
 */

import type { PrismaClient } from '@prisma/client';

import { PURGE_RETENTION_MS } from '../config/constants.js';

/** Keeps `IN (...)` lists bounded on large backlogs. */
const PURGE_BATCH_SIZE = 500;

/** Instant before which results are considered expired (now − 6 months). */
export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - PURGE_RETENTION_MS);
}

/**
 * Round archive retention purge (R18). `GameResult` is a flat archive with no
 * relations/cascades, so a single batched delete is sufficient.
 */
export interface GamePurgeSummary {
  cutoff: Date;
  deletedResults: number;
}

export type GamePurgeClient = Pick<PrismaClient, 'gameResult'>;

/**
 * Expired live sessions also contain round results (StreetRound and
 * LobbyRound/lobby results). They must not outlive their session window just
 * because R18's archive is purged separately.
 */
export interface SessionPurgeSummary {
  cutoff: Date;
  deletedStreetGames: number;
  deletedLobbies: number;
}

export type SessionPurgeClient = Pick<
  PrismaClient,
  'streetGame' | 'lobby'
>;

/**
 * Removes expired singleplayer sessions and lobbies (cascading their rounds,
 * attempts, and results). Runs daily so stale result-bearing rows cannot
 * accumulate indefinitely.
 */
export async function purgeExpiredGameSessions(
  db: SessionPurgeClient,
  now: Date = new Date(),
): Promise<SessionPurgeSummary> {
  const [streetGames, lobbies] = await Promise.all([
    db.streetGame.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.lobby.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return {
    cutoff: now,
    deletedStreetGames: streetGames.count,
    deletedLobbies: lobbies.count,
  };
}

/**
 * Purges completed round archives older than the retention window.
 *
 * @param db  Prisma client (or a test stub with the same delegate).
 * @param now Clock injection point; defaults to the current time.
 */
export async function purgeExpiredGameResults(
  db: GamePurgeClient,
  now: Date = new Date(),
): Promise<GamePurgeSummary> {
  const cutoff = purgeCutoff(now);
  let deletedResults = 0;

  for (;;) {
    const expired = await db.gameResult.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: PURGE_BATCH_SIZE,
    });
    if (expired.length === 0) break;
    const deleted = await db.gameResult.deleteMany({
      where: { id: { in: expired.map((row) => row.id) } },
    });
    deletedResults += deleted.count;
    if (expired.length < PURGE_BATCH_SIZE) break;
  }

  return { cutoff, deletedResults };
}
