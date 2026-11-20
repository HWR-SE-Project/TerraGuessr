/**
 * Auth artifact retention (ADR-0013).
 *
 * Expired sessions, reset links, verification links, and pending address
 * changes have no value once past their deadline. Deleting them keeps the
 * tables small and makes sure a stolen database cannot reveal stale material.
 */

import type { PrismaClient } from '@prisma/client';

import { AUTH_SESSION_IDLE_TTL_MS } from '../modules/auth/service.js';

export type AuthCleanupClient = Pick<
  PrismaClient,
  'authSession' | 'passwordResetToken' | 'emailVerificationToken' | 'emailChangeRequest'
>;

export interface AuthCleanupSummary {
  deletedSessions: number;
  deletedResetTokens: number;
  deletedVerificationTokens: number;
  deletedEmailChanges: number;
}

/** Removes rows that are past their absolute expiry, idle expiry, or completed. */
export async function purgeExpiredAuthArtifacts(
  db: AuthCleanupClient,
  now: Date = new Date(),
): Promise<AuthCleanupSummary> {
  const idleCutoff = new Date(now.getTime() - AUTH_SESSION_IDLE_TTL_MS);
  const [sessions, resetTokens, verificationTokens, emailChanges] = await Promise.all([
    db.authSession.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { lastUsedAt: { lte: idleCutoff } }] },
    }),
    db.passwordResetToken.deleteMany({ where: { expiresAt: { lte: now } } }),
    db.emailVerificationToken.deleteMany({ where: { expiresAt: { lte: now } } }),
    db.emailChangeRequest.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { completedAt: { not: null } }] },
    }),
  ]);
  return {
    deletedSessions: sessions.count,
    deletedResetTokens: resetTokens.count,
    deletedVerificationTokens: verificationTokens.count,
    deletedEmailChanges: emailChanges.count,
  };
}
