/**
 * Retention purge (B-09, R18 — architecture.md §7a, decision B.6).
 *
 * Street View singleplayer rounds are archived in `StreetResult`, a flat
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
 * Street View singleplayer retention purge (R18). `StreetResult` is a flat
 * archive with no relations/cascades, so a single batched delete is
 * sufficient.
 */
export interface StreetPurgeSummary {
  cutoff: Date;
  deletedResults: number;
}

export type StreetPurgeClient = Pick<PrismaClient, 'streetResult'>;

/**
 * Purges completed Street View results older than the retention window.
 *
 * @param db  Prisma client (or a test stub with the same delegate).
 * @param now Clock injection point; defaults to the current time.
 */
export async function purgeExpiredStreetResults(
  db: StreetPurgeClient,
  now: Date = new Date(),
): Promise<StreetPurgeSummary> {
  const cutoff = purgeCutoff(now);
  let deletedResults = 0;

  for (;;) {
    const expired = await db.streetResult.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: PURGE_BATCH_SIZE,
    });
    if (expired.length === 0) break;
    const deleted = await db.streetResult.deleteMany({
      where: { id: { in: expired.map((row) => row.id) } },
    });
    deletedResults += deleted.count;
    if (expired.length < PURGE_BATCH_SIZE) break;
  }

  return { cutoff, deletedResults };
}
