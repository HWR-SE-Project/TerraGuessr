/**
 * Retention purge (B-09, R18 — architecture.md §7a, decision B.6).
 *
 * Completed rounds for signed-in players are archived in `GameResult`.
 */

import type { PrismaClient } from '@prisma/client';

import {
  settleTimedOutLobbyRounds,
  settleTimedOutStreetRounds,
  type SettlementClient,
} from '../domain/settlement.js';

/** Bounds the number of rows deleted per statement. */
const PURGE_BATCH_SIZE = 500;

export interface GamePurgeSummary {
  checkedAt: Date;
  deletedResults: number;
}

export type GamePurgeClient = Pick<PrismaClient, '$executeRaw'>;

/**
 * Expired live sessions also contain round results (StreetRound and
 * LobbyRound/lobby results). They must not outlive their session window just
 * because R18's archive is purged separately.
 */
export interface SessionPurgeSummary {
  cutoff: Date;
  settledStreetRounds: number;
  settledLobbyResults: number;
  deletedStreetGames: number;
  deletedLobbies: number;
}

export type SessionPurgeClient = Pick<PrismaClient, 'streetGame' | 'lobby'> &
  SettlementClient;

/**
 * Settles any timed-out rounds on expired authenticated singleplayer sessions
 * before deleting expired `StreetGame` rows (R08/R18).
 */
export async function purgeExpiredStreetGames(
  db: Pick<PrismaClient, 'streetGame'> & SettlementClient,
  now: Date = new Date(),
): Promise<{ settledStreetRounds: number; deletedStreetGames: number }> {
  const settledStreetRounds = await settleTimedOutStreetRounds(db, now, {
    expiredGamesOnly: true,
  });
  const streetGames = await db.streetGame.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return {
    settledStreetRounds,
    deletedStreetGames: streetGames.count,
  };
}

/**
 * Settles any unattended timed-out rounds for signed-in accounts before
 * removing expired singleplayer sessions and lobbies (cascading their rounds,
 * attempts, and results). Runs daily so stale result-bearing rows cannot
 * accumulate indefinitely while never dropping timed-out authenticated results.
 */
export async function purgeExpiredGameSessions(
  db: SessionPurgeClient,
  now: Date = new Date(),
): Promise<SessionPurgeSummary> {
  const [settledStreetRounds, settledLobbyResults] = await Promise.all([
    settleTimedOutStreetRounds(db, now, { expiredGamesOnly: true }),
    settleTimedOutLobbyRounds(db, now, { expiredLobbiesOnly: true }),
  ]);
  const [streetGames, lobbies] = await Promise.all([
    db.streetGame.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.lobby.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return {
    cutoff: now,
    settledStreetRounds,
    settledLobbyResults,
    deletedStreetGames: streetGames.count,
    deletedLobbies: lobbies.count,
  };
}

/**
 * Purges each archive at six calendar months after creation. PostgreSQL
 * clamps the expiry day to the end of a shorter month.
 */
export async function purgeExpiredGameResults(
  db: GamePurgeClient,
  now: Date = new Date(),
): Promise<GamePurgeSummary> {
  let deletedResults = 0;
  let batchSize: number;
  do {
    // The first predicate bounds the scan on the createdAt index. The second
    // checks the exact expiry, including the time of day on a clamped date.
    batchSize = await db.$executeRaw`
      WITH retention AS (
        SELECT ${now.toISOString()}::timestamptz AT TIME ZONE 'UTC' AS "checkedAt",
               INTERVAL '6 months' AS "duration"
      ),
      expired AS (
        SELECT "GameResult"."id"
        FROM "GameResult" CROSS JOIN retention
        WHERE "createdAt" < date_trunc('month', "checkedAt" - "duration") + INTERVAL '1 month'
          AND "createdAt" + "duration" <= "checkedAt"
        ORDER BY "createdAt"
        LIMIT ${PURGE_BATCH_SIZE}
        FOR UPDATE OF "GameResult" SKIP LOCKED
      )
      DELETE FROM "GameResult" USING expired
      WHERE "GameResult"."id" = expired."id"
    `;
    deletedResults += batchSize;
  } while (batchSize === PURGE_BATCH_SIZE);

  return { checkedAt: now, deletedResults };
}
