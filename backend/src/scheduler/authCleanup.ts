/**
 * Auth artifact retention (ADR-0013).
 *
 * Expired sessions, reset links, verification links, and pending address
 * changes have no value once past their deadline. Deleting them in bounded
 * `FOR UPDATE SKIP LOCKED` batches keeps tables small, avoids long table locks,
 * and stays safe if multiple replicas run concurrently.
 */

import type { PrismaClient } from '@prisma/client';

import { AUTH_SESSION_IDLE_TTL_MS } from '../modules/auth/service.js';

export const AUTH_CLEANUP_BATCH_SIZE = 500;

export type AuthCleanupClient = Pick<PrismaClient, '$executeRaw'>;

export interface AuthCleanupSummary {
  deletedSessions: number;
  deletedResetTokens: number;
  deletedVerificationTokens: number;
  deletedEmailChanges: number;
}

async function deleteInBatches(
  runBatch: () => Promise<number>,
): Promise<number> {
  let total = 0;
  let batchSize: number;
  do {
    batchSize = await runBatch();
    total += batchSize;
  } while (batchSize === AUTH_CLEANUP_BATCH_SIZE);
  return total;
}

/** Removes rows that are past their absolute expiry, idle expiry, or completed. */
export async function purgeExpiredAuthArtifacts(
  db: AuthCleanupClient,
  now: Date = new Date(),
): Promise<AuthCleanupSummary> {
  const idleCutoff = new Date(now.getTime() - AUTH_SESSION_IDLE_TTL_MS);

  const [deletedSessions, deletedResetTokens, deletedVerificationTokens, deletedEmailChanges] =
    await Promise.all([
      deleteInBatches(() =>
        db.$executeRaw`
          WITH expired AS (
            SELECT "id"
            FROM "AuthSession"
            WHERE "expiresAt" <= ${now} OR "lastUsedAt" <= ${idleCutoff}
            LIMIT ${AUTH_CLEANUP_BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM "AuthSession" USING expired
          WHERE "AuthSession"."id" = expired."id"
        `,
      ),
      deleteInBatches(() =>
        db.$executeRaw`
          WITH expired AS (
            SELECT "id"
            FROM "PasswordResetToken"
            WHERE "expiresAt" <= ${now}
            LIMIT ${AUTH_CLEANUP_BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM "PasswordResetToken" USING expired
          WHERE "PasswordResetToken"."id" = expired."id"
        `,
      ),
      deleteInBatches(() =>
        db.$executeRaw`
          WITH expired AS (
            SELECT "id"
            FROM "EmailVerificationToken"
            WHERE "expiresAt" <= ${now}
            LIMIT ${AUTH_CLEANUP_BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM "EmailVerificationToken" USING expired
          WHERE "EmailVerificationToken"."id" = expired."id"
        `,
      ),
      deleteInBatches(() =>
        db.$executeRaw`
          WITH expired AS (
            SELECT "id"
            FROM "EmailChangeRequest"
            WHERE "expiresAt" <= ${now} OR "completedAt" IS NOT NULL
            LIMIT ${AUTH_CLEANUP_BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM "EmailChangeRequest" USING expired
          WHERE "EmailChangeRequest"."id" = expired."id"
        `,
      ),
    ]);

  return {
    deletedSessions,
    deletedResetTokens,
    deletedVerificationTokens,
    deletedEmailChanges,
  };
}
