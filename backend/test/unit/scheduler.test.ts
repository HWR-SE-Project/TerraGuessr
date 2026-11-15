import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PURGE_CRON_EXPRESSION,
  PURGE_CRON_TIMEZONE,
  startScheduler,
} from '../../src/scheduler/index.js';
import type { PurgeClient } from '../../src/scheduler/purge.js';

describe('startScheduler (R18, node-cron v4 wiring)', () => {
  let task: { stop: () => void | Promise<void> } | undefined;

  afterEach(async () => {
    await task?.stop();
    task = undefined;
  });

  it('schedules the daily purge at 03:00 UTC and returns a controllable task', () => {
    const db = {} as unknown as PurgeClient;

    task = startScheduler(db);

    expect(PURGE_CRON_EXPRESSION).toBe('0 3 * * *');
    expect(PURGE_CRON_TIMEZONE).toBe('UTC');
    expect(task).toBeDefined();
    expect(typeof task?.stop).toBe('function');
  });

  it('logs a failure through the injected logger if the purge throws, never a crash', async () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const db = {
      result: { findMany: vi.fn().mockRejectedValue(new Error('db down')) },
    } as unknown as PurgeClient;

    task = startScheduler(db, log);
    // Run the scheduled job body directly instead of waiting for 03:00 UTC.
    // The job itself is fire-and-forget (void ...then().catch()), so execute()
    // resolving doesn't guarantee the catch handler has run yet — poll for it.
    await task.execute();
    await vi.waitFor(() => {
      expect(log.error).toHaveBeenCalled();
    });

    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'retention purge failed',
    );
  });
});
