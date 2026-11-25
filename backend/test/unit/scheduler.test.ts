import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledTask } from 'node-cron';
import {
  PURGE_CRON_EXPRESSION,
  PURGE_CRON_TIMEZONE,
  SESSION_PURGE_CRON_EXPRESSION,
  startScheduler,
  stopScheduler,
} from '../../src/scheduler/index.js';
import type { SchedulerClient, SchedulerHandle } from '../../src/scheduler/index.js';

describe('startScheduler (R18, node-cron v4 wiring)', () => {
  let task: SchedulerHandle | undefined;

  afterEach(async () => {
    await stopScheduler(task);
    task = undefined;
  });

  it('schedules the daily retention purge at 03:00 UTC and hourly session purge', () => {
    const db = {} as unknown as SchedulerClient;

    task = startScheduler(db);

    expect(PURGE_CRON_EXPRESSION).toBe('0 3 * * *');
    expect(SESSION_PURGE_CRON_EXPRESSION).toBe('0 * * * *');
    expect(PURGE_CRON_TIMEZONE).toBe('UTC');
    expect(task).toBeDefined();
    expect(typeof task.stop).toBe('function');
    expect(typeof task.destroy).toBe('function');
    expect(task.dailyTask).toBeDefined();
    expect(task.sessionTask).toBeDefined();
  });

  it('logs a failure through the injected logger if the purge throws, never a crash', async () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const db = {
      $executeRaw: vi.fn().mockRejectedValue(new Error('db down')),
    } as unknown as SchedulerClient;

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
      'game result retention purge failed',
    );
  });

  it('stopScheduler stops and destroys a task and ignores undefined', async () => {
    const fakeTask = {
      stop: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as unknown as ScheduledTask;

    await stopScheduler(undefined);
    await stopScheduler(fakeTask);

    expect(fakeTask.stop).toHaveBeenCalledTimes(1);
    expect(fakeTask.destroy).toHaveBeenCalledTimes(1);
  });
});
