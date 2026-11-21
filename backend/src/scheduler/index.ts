/**
 * In-process scheduler (R18, architecture.md §7a). The retention purge and
 * auth-artifact cleanup run once a day; prefetch is event-driven, not scheduled.
 */

import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';

import {
  purgeExpiredGameResults,
  purgeExpiredGameSessions,
} from './purge.js';
import type { GamePurgeClient, SessionPurgeClient } from './purge.js';
import { purgeExpiredAuthArtifacts } from './authCleanup.js';
import type { AuthCleanupClient } from './authCleanup.js';

/** Daily at 03:00 UTC. */
export const PURGE_CRON_EXPRESSION = '0 3 * * *';
export const PURGE_CRON_TIMEZONE = 'UTC';

/** Everything the daily maintenance job needs. */
export type SchedulerClient = AuthCleanupClient &
  GamePurgeClient &
  SessionPurgeClient;

/** Pino-shaped logger (Fastify's `app.log`); keeps this module console-free. */
export interface SchedulerLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

const noopLogger: SchedulerLogger = { info: () => {}, error: () => {} };

/**
 * Registers the daily retention purge and auth cleanup, returning the task so
 * the caller can stop it on shutdown. Tests never start it.
 */
export function startScheduler(
  db: SchedulerClient,
  log: SchedulerLogger = noopLogger,
): ScheduledTask {
  return cron.schedule(
    PURGE_CRON_EXPRESSION,
    () => {
      void purgeExpiredGameResults(db)
        .then((summary) => {
          if (summary.deletedResults > 0) {
            log.info(
              {
                deletedResults: summary.deletedResults,
                cutoff: summary.cutoff.toISOString(),
              },
              'game result retention purge completed',
            );
          }
        })
        .catch((err: unknown) => {
          log.error({ err }, 'game result retention purge failed');
        });

      void purgeExpiredGameSessions(db)
        .then((summary) => {
          if (summary.deletedStreetGames + summary.deletedLobbies > 0) {
            log.info(summary, 'expired game session purge completed');
          }
        })
        .catch((err: unknown) => {
          log.error({ err }, 'expired game session purge failed');
        });

      void purgeExpiredAuthArtifacts(db)
        .then((summary) => {
          const total = summary.deletedSessions + summary.deletedResetTokens +
            summary.deletedVerificationTokens + summary.deletedEmailChanges;
          if (total > 0) log.info(summary, 'auth cleanup completed');
        })
        .catch((err: unknown) => {
          log.error({ err }, 'auth cleanup failed');
        });
    },
    { timezone: PURGE_CRON_TIMEZONE },
  );
}
