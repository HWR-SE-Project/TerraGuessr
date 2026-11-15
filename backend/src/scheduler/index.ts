/**
 * In-process scheduler (R18, architecture.md §7a). The retention purge is the
 * only cron job; prefetch is event-driven, not scheduled.
 */

import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';

import { purgeExpiredResults } from './purge.js';
import type { PurgeClient } from './purge.js';

/** Daily at 03:00 UTC. */
export const PURGE_CRON_EXPRESSION = '0 3 * * *';
export const PURGE_CRON_TIMEZONE = 'UTC';

/** Pino-shaped logger (Fastify's `app.log`); keeps this module console-free. */
export interface SchedulerLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

const noopLogger: SchedulerLogger = { info: () => {}, error: () => {} };

/**
 * Registers the daily retention purge and returns the task so the caller can
 * stop it on shutdown. Tests never start it.
 */
export function startScheduler(
  db: PurgeClient,
  log: SchedulerLogger = noopLogger,
): ScheduledTask {
  return cron.schedule(
    PURGE_CRON_EXPRESSION,
    () => {
      void purgeExpiredResults(db)
        .then((summary) => {
          if (summary.deletedResults > 0) {
            log.info(
              {
                deletedResults: summary.deletedResults,
                deletedGuesses: summary.deletedGuesses,
                deletedRounds: summary.deletedRounds,
                cutoff: summary.cutoff.toISOString(),
              },
              'retention purge completed',
            );
          }
        })
        .catch((err: unknown) => {
          log.error({ err }, 'retention purge failed');
        });
    },
    { timezone: PURGE_CRON_TIMEZONE },
  );
}
