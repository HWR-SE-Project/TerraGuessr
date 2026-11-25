/**
 * In-process scheduler (R18, architecture.md §7a). Archive retention and
 * auth-artifact cleanup run daily; expired live-session settlement/deletion
 * runs hourly so expired games never rely on synchronous user-request purges.
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

/** Daily at 03:00 UTC (6-month archive retention + auth artifact cleanup). */
export const PURGE_CRON_EXPRESSION = '0 3 * * *';
/** Hourly on the hour UTC (expired singleplayer games + lobbies). */
export const SESSION_PURGE_CRON_EXPRESSION = '0 * * * *';
export const PURGE_CRON_TIMEZONE = 'UTC';

/** Everything the scheduled maintenance jobs need. */
export type SchedulerClient = AuthCleanupClient &
  GamePurgeClient &
  SessionPurgeClient;

/** Pino-shaped logger (Fastify's `app.log`); keeps this module console-free. */
export interface SchedulerLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/** Controllable handle covering every scheduled task registered by `startScheduler`. */
export interface SchedulerHandle {
  dailyTask: ScheduledTask;
  sessionTask: ScheduledTask;
  execute(): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;
}

const noopLogger: SchedulerLogger = { info: () => {}, error: () => {} };

/**
 * Registers the daily retention/auth cleanup and hourly expired-session purge,
 * returning a handle so the caller can stop every task on shutdown. Tests never
 * start it automatically.
 */
export function startScheduler(
  db: SchedulerClient,
  log: SchedulerLogger = noopLogger,
): SchedulerHandle {
  const dailyTask = cron.schedule(
    PURGE_CRON_EXPRESSION,
    () => {
      void purgeExpiredGameResults(db)
        .then((summary) => {
          if (summary.deletedResults > 0) {
            log.info(
              {
                deletedResults: summary.deletedResults,
                checkedAt: summary.checkedAt.toISOString(),
              },
              'game result retention purge completed',
            );
          }
        })
        .catch((err: unknown) => {
          log.error({ err }, 'game result retention purge failed');
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

  const sessionTask = cron.schedule(
    SESSION_PURGE_CRON_EXPRESSION,
    () => {
      void purgeExpiredGameSessions(db)
        .then((summary) => {
          if (summary.deletedStreetGames + summary.deletedLobbies > 0) {
            log.info(summary, 'expired game session purge completed');
          }
        })
        .catch((err: unknown) => {
          log.error({ err }, 'expired game session purge failed');
        });
    },
    { timezone: PURGE_CRON_TIMEZONE },
  );

  return {
    dailyTask,
    sessionTask,
    async execute() {
      await Promise.all([dailyTask.execute(), sessionTask.execute()]);
    },
    async stop() {
      await Promise.all([dailyTask.stop(), sessionTask.stop()]);
    },
    async destroy() {
      await Promise.all([dailyTask.destroy(), sessionTask.destroy()]);
    },
  };
}

/** Stops and destroys all scheduled tasks during graceful shutdown. */
export async function stopScheduler(
  task: Pick<ScheduledTask, 'stop' | 'destroy'> | undefined,
): Promise<void> {
  if (!task) return;
  await task.stop();
  await task.destroy();
}
