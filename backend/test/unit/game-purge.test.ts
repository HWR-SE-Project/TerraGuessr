import { describe, expect, it, vi } from 'vitest';

import { purgeExpiredGameResults } from '../../src/scheduler/purge.js';
import type { GamePurgeClient } from '../../src/scheduler/purge.js';

const NOW = new Date('2026-11-20T03:00:00.000Z');

function makeDb(...batchSizes: number[]) {
  const executeRaw = vi.fn<() => Promise<number>>();
  for (const size of batchSizes) executeRaw.mockResolvedValueOnce(size);
  const db = { $executeRaw: executeRaw } as unknown as GamePurgeClient;
  return { db, executeRaw };
}

describe('purgeExpiredGameResults (R18)', () => {
  it('runs a single batch when no results are expired', async () => {
    const { db, executeRaw } = makeDb(0);

    expect(await purgeExpiredGameResults(db, NOW)).toEqual({ checkedAt: NOW, deletedResults: 0 });
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('uses the same reference time for each batch and returns the total deleted', async () => {
    const { db, executeRaw } = makeDb(500, 500, 200);

    expect(await purgeExpiredGameResults(db, NOW)).toEqual({ checkedAt: NOW, deletedResults: 1200 });
    expect(executeRaw).toHaveBeenCalledTimes(3);
    for (const call of executeRaw.mock.calls) {
      expect(call).toEqual([expect.any(Array), NOW.toISOString(), 500]);
    }
  });
});
