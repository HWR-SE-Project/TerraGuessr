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

export type SessionPurgeClient = Pick<PrismaClient, '$executeRaw'> &
  SettlementClient;

async function deleteExpiredStreetGamesBatched(
  db: Pick<PrismaClient, '$executeRaw'>,
  now: Date,
): Promise<number> {
  let deleted = 0;
  let batchSize: number;
  do {
    batchSize = await db.$executeRaw`
      WITH expired AS (
        SELECT "id"
        FROM "StreetGame"
        WHERE "expiresAt" < ${now}
        ORDER BY "expiresAt"
        LIMIT ${PURGE_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "StreetGame" USING expired
      WHERE "StreetGame"."id" = expired."id"
    `;
    deleted += batchSize;
  } while (batchSize === PURGE_BATCH_SIZE);
  return deleted;
}

async function deleteExpiredLobbiesBatched(
  db: Pick<PrismaClient, '$executeRaw'>,
  now: Date,
): Promise<number> {
  let deleted = 0;
  let batchSize: number;
  do {
    batchSize = await db.$executeRaw`
      WITH expired AS (
        SELECT "id"
        FROM "Lobby"
        WHERE "expiresAt" < ${now}
        ORDER BY "expiresAt"
        LIMIT ${PURGE_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "Lobby" USING expired
      WHERE "Lobby"."id" = expired."id"
    `;
    deleted += batchSize;
  } while (batchSize === PURGE_BATCH_SIZE);
  return deleted;
}

/**
 * Settles any timed-out rounds on expired authenticated singleplayer sessions
 * before deleting expired `StreetGame` rows in bounded lock-safe batches (R08/R18).
 */
export async function purgeExpiredStreetGames(
  db: Pick<PrismaClient, '$executeRaw'> & SettlementClient,
  now: Date = new Date(),
): Promise<{ settledStreetRounds: number; deletedStreetGames: number }> {
  const settledStreetRounds = await settleTimedOutStreetRounds(db, now, {
    expiredGamesOnly: true,
  });
  const deletedStreetGames = await deleteExpiredStreetGamesBatched(db, now);
  return {
    settledStreetRounds,
    deletedStreetGames,
  };
}

/**
 * Settles any unattended timed-out rounds for signed-in accounts before
 * removing expired singleplayer sessions and lobbies in bounded batches
 * (cascading their rounds, attempts, and results). Runs hourly via the
 * scheduler so stale rows cannot accumulate while never blocking on large deletes.
 */
export async function purgeExpiredGameSessions(
  db: SessionPurgeClient,
  now: Date = new Date(),
): Promise<SessionPurgeSummary> {
  const [settledStreetRounds, settledLobbyResults] = await Promise.all([
    settleTimedOutStreetRounds(db, now, { expiredGamesOnly: true }),
    settleTimedOutLobbyRounds(db, now, { expiredLobbiesOnly: true }),
  ]);
  const [deletedStreetGames, deletedLobbies] = await Promise.all([
    deleteExpiredStreetGamesBatched(db, now),
    deleteExpiredLobbiesBatched(db, now),
  ]);
  return {
    cutoff: now,
    settledStreetRounds,
    settledLobbyResults,
    deletedStreetGames,
    deletedLobbies,
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
