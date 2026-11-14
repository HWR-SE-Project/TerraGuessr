import { describe, expect, it, vi } from 'vitest';

import { PURGE_RETENTION_MS } from '../../src/config/constants.js';
import {
  purgeCutoff,
  purgeExpiredResults,
} from '../../src/scheduler/purge.js';
import type { PurgeClient } from '../../src/scheduler/purge.js';

const NOW = new Date('2026-11-15T03:00:00.000Z');
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

interface ResultRow {
  id: string;
  roundId: string;
  createdAt: Date;
}

interface HistoryRow {
  id: string;
  roundId: string;
}

interface Seed {
  results: ResultRow[];
  guesses: HistoryRow[];
  challenges: HistoryRow[];
  rounds: Array<{ id: string }>;
}

/** Removes rows whose `key` is in `ids`; returns Prisma's `{ count }` shape. */
function removeById<T extends Record<K, string>, K extends keyof T>(
  rows: T[],
  key: K,
  ids: readonly string[],
): { count: number } {
  const wanted = new Set(ids);
  const before = rows.length;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row && wanted.has(row[key])) rows.splice(i, 1);
  }
  return { count: before - rows.length };
}

/**
 * Stub Prisma client holding the tables in memory. `location` is present only
 * so the test can prove the purge never touches the pool.
 */
function makeDb(seed: Seed) {
  const results = [...seed.results];
  const guesses = [...seed.guesses];
  const challenges = [...seed.challenges];
  const rounds = [...seed.rounds];

  const location = {
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };

  const result = {
    findMany: vi.fn(
      async (args: { where: { createdAt: { lt: Date } } }): Promise<
        Array<{ id: string; roundId: string }>
      > =>
        results
          .filter((row) => row.createdAt.getTime() < args.where.createdAt.lt.getTime())
          .map((row) => ({ id: row.id, roundId: row.roundId })),
    ),
    deleteMany: vi.fn(
      async (args: { where: { id: { in: string[] } } }) =>
        removeById(results, 'id', args.where.id.in),
    ),
  };

  const guess = {
    deleteMany: vi.fn(
      async (args: { where: { roundId: { in: string[] } } }) =>
        removeById(guesses, 'roundId', args.where.roundId.in),
    ),
  };

  const challenge = {
    deleteMany: vi.fn(
      async (args: { where: { roundId: { in: string[] } } }) =>
        removeById(challenges, 'roundId', args.where.roundId.in),
    ),
  };

  const round = {
    deleteMany: vi.fn(
      async (args: { where: { id: { in: string[] } } }) =>
        removeById(rounds, 'id', args.where.id.in),
    ),
  };

  const db = {
    result,
    guess,
    challenge,
    round,
    location,
    $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  };

  return {
    db: db as unknown as PurgeClient,
    results,
    guesses,
    challenges,
    rounds,
    location,
    result,
    round,
  };
}

const OLD: ResultRow = {
  id: 'result-old',
  roundId: 'round-old',
  createdAt: new Date(NOW.getTime() - 7 * MONTH_MS),
};
const RECENT: ResultRow = {
  id: 'result-recent',
  roundId: 'round-recent',
  createdAt: new Date(NOW.getTime() - 1 * MONTH_MS),
};

function seed(): Seed {
  return {
    results: [OLD, RECENT],
    guesses: [
      { id: 'guess-old', roundId: 'round-old' },
      { id: 'guess-recent', roundId: 'round-recent' },
    ],
    challenges: [
      { id: 'challenge-old', roundId: 'round-old' },
      { id: 'challenge-recent', roundId: 'round-recent' },
    ],
    rounds: [{ id: 'round-old' }, { id: 'round-recent' }],
  };
}

describe('purgeCutoff', () => {
  it('is now minus the 6-month retention window', () => {
    expect(purgeCutoff(NOW).getTime()).toBe(NOW.getTime() - PURGE_RETENTION_MS);
  });
});

describe('purgeExpiredResults (R18)', () => {
  it('deletes results older than 6 months and keeps recent ones', async () => {
    const ctx = makeDb(seed());

    const summary = await purgeExpiredResults(ctx.db, NOW);

    expect(summary.deletedResults).toBe(1);
    expect(summary.deletedRounds).toBe(1);
    expect(summary.deletedGuesses).toBe(1);
    expect(ctx.results.map((row) => row.id)).toEqual(['result-recent']);
  });

  it('purges the orphaned round history (guess, challenge, round) of old results only', async () => {
    const ctx = makeDb(seed());

    await purgeExpiredResults(ctx.db, NOW);

    expect(ctx.guesses.map((row) => row.id)).toEqual(['guess-recent']);
    expect(ctx.challenges.map((row) => row.id)).toEqual(['challenge-recent']);
    expect(ctx.rounds.map((row) => row.id)).toEqual(['round-recent']);
  });

  it('never touches the Location pool', async () => {
    const ctx = makeDb(seed());

    await purgeExpiredResults(ctx.db, NOW);

    expect(ctx.location.delete).not.toHaveBeenCalled();
    expect(ctx.location.deleteMany).not.toHaveBeenCalled();
  });

  it('does nothing when no result is expired', async () => {
    const ctx = makeDb({
      results: [RECENT],
      guesses: [{ id: 'guess-recent', roundId: 'round-recent' }],
      challenges: [],
      rounds: [{ id: 'round-recent' }],
    });

    const summary = await purgeExpiredResults(ctx.db, NOW);

    expect(summary.deletedResults).toBe(0);
    expect(ctx.result.deleteMany).not.toHaveBeenCalled();
    expect(ctx.round.deleteMany).not.toHaveBeenCalled();
    expect(ctx.results.map((row) => row.id)).toEqual(['result-recent']);
  });
});
