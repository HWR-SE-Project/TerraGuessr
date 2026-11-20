import { describe, expect, it, vi } from 'vitest';

import { PURGE_RETENTION_MS } from '../../src/config/constants.js';
import { purgeExpiredStreetResults } from '../../src/scheduler/purge.js';
import type { StreetPurgeClient } from '../../src/scheduler/purge.js';

const NOW = new Date('2026-11-20T03:00:00.000Z');
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

interface Row {
  id: string;
  createdAt: Date;
}

function makeDb(rows: Row[]) {
  const table = [...rows];
  const streetResult = {
    findMany: vi.fn(
      async (args: {
        where: { createdAt: { lt: Date } };
        take: number;
      }): Promise<Array<{ id: string }>> =>
        table
          .filter((row) => row.createdAt.getTime() < args.where.createdAt.lt.getTime())
          .slice(0, args.take)
          .map((row) => ({ id: row.id })),
    ),
    deleteMany: vi.fn(async (args: { where: { id: { in: string[] } } }) => {
      const wanted = new Set(args.where.id.in);
      const before = table.length;
      for (let i = table.length - 1; i >= 0; i -= 1) {
        if (wanted.has(table[i]!.id)) table.splice(i, 1);
      }
      return { count: before - table.length };
    }),
  };
  return {
    db: { streetResult } as unknown as StreetPurgeClient,
    table,
    streetResult,
  };
}

const OLD: Row = { id: 'old-1', createdAt: new Date(NOW.getTime() - 7 * MONTH_MS) };
const RECENT: Row = { id: 'recent-1', createdAt: new Date(NOW.getTime() - MONTH_MS) };

describe('purgeExpiredStreetResults (R18)', () => {
  it('uses the same 6-month cutoff as the weather-game purge', async () => {
    const ctx = makeDb([OLD, RECENT]);
    const summary = await purgeExpiredStreetResults(ctx.db, NOW);
    expect(summary.cutoff.getTime()).toBe(NOW.getTime() - PURGE_RETENTION_MS);
  });

  it('deletes results older than 6 months and keeps recent ones', async () => {
    const ctx = makeDb([OLD, RECENT]);
    const summary = await purgeExpiredStreetResults(ctx.db, NOW);
    expect(summary.deletedResults).toBe(1);
    expect(ctx.table.map((r) => r.id)).toEqual(['recent-1']);
  });

  it('does nothing when nothing is expired', async () => {
    const ctx = makeDb([RECENT]);
    const summary = await purgeExpiredStreetResults(ctx.db, NOW);
    expect(summary.deletedResults).toBe(0);
    expect(ctx.streetResult.deleteMany).not.toHaveBeenCalled();
  });

  it('paginates across batches larger than one page', async () => {
    const many = Array.from({ length: 1200 }, (_, i) => ({
      id: `old-${i}`,
      createdAt: new Date(NOW.getTime() - 7 * MONTH_MS),
    }));
    const ctx = makeDb(many);
    const summary = await purgeExpiredStreetResults(ctx.db, NOW);
    expect(summary.deletedResults).toBe(1200);
    expect(ctx.table).toHaveLength(0);
  });
});
