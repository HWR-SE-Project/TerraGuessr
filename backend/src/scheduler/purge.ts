/**
 * Retention purge (B-09, R18 — architecture.md §7a, decision B.6).
 *
 * Deletes `Result` rows whose `createdAt` is older than the 6-month retention
 * window, together with the round history they leave behind (`Guess`,
 * `Challenge`, `Round`). The `Location` pool is shared, curated data and is
 * NEVER deleted here — `Round.location` has no cascade in the schema
 * (data-model.md note), so the purge simply never touches that table.
 *
 * Deletes run per batch inside one `$transaction`, so a crash cannot leave a
 * half-purged round behind: either the whole batch commits or none of it does,
 * and an unprocessed batch still has its `Result` rows to be picked up next run.
 */

import type { PrismaClient } from '@prisma/client';

import { PURGE_RETENTION_MS } from '../config/constants.js';

/** Only the delegates the purge needs, so tests can inject a stub. */
export type PurgeClient = Pick<
  PrismaClient,
  'result' | 'guess' | 'round' | 'challenge' | '$transaction'
>;

export interface PurgeSummary {
  /** Results created strictly before this instant were purged. */
  cutoff: Date;
  deletedResults: number;
  deletedGuesses: number;
  deletedRounds: number;
}

/** Keeps `IN (...)` lists bounded on large backlogs. */
const PURGE_BATCH_SIZE = 500;

/** Instant before which results are considered expired (now − 6 months). */
export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - PURGE_RETENTION_MS);
}

/**
 * Purges results (and their round history) older than the retention window.
 *
 * @param db  Prisma client (or a test stub with the same delegates).
 * @param now Clock injection point; defaults to the current time.
 */
export async function purgeExpiredResults(
  db: PurgeClient,
  now: Date = new Date(),
): Promise<PurgeSummary> {
  const cutoff = purgeCutoff(now);

  const expired = await db.result.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, roundId: true },
  });

  const summary: PurgeSummary = {
    cutoff,
    deletedResults: 0,
    deletedGuesses: 0,
    deletedRounds: 0,
  };

  for (let i = 0; i < expired.length; i += PURGE_BATCH_SIZE) {
    const batch = expired.slice(i, i + PURGE_BATCH_SIZE);
    const resultIds = batch.map((row) => row.id);
    const roundIds = [...new Set(batch.map((row) => row.roundId))];

    // Order matters: Challenge.round has no cascade, so challenges referencing
    // the purged rounds must go before the rounds themselves. Deleting Result
    // cascades ChallengeEntry (schema), and Guess is removed explicitly before
    // Round so the intent is readable even though Round->Guess cascades too.
    const [deletedResults, guesses, , rounds] = await db.$transaction([
      db.result.deleteMany({ where: { id: { in: resultIds } } }),
      db.guess.deleteMany({ where: { roundId: { in: roundIds } } }),
      db.challenge.deleteMany({ where: { roundId: { in: roundIds } } }),
      db.round.deleteMany({ where: { id: { in: roundIds } } }),
    ]);

    summary.deletedResults += deletedResults.count;
    summary.deletedGuesses += guesses.count;
    summary.deletedRounds += rounds.count;
  }

  return summary;
}
