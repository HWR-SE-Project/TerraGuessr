import { describe, expect, it, vi } from 'vitest';
import { purgeExpiredAuthArtifacts } from '../../src/scheduler/authCleanup.js';
import type { AuthCleanupClient } from '../../src/scheduler/authCleanup.js';
import { AUTH_SESSION_IDLE_TTL_MS } from '../../src/modules/auth/service.js';

function stubClient() {
  const deleted = { authSession: 2, passwordResetToken: 3, emailVerificationToken: 4, emailChangeRequest: 5 };
  const client = {
    authSession: { deleteMany: vi.fn().mockResolvedValue({ count: deleted.authSession }) },
    passwordResetToken: { deleteMany: vi.fn().mockResolvedValue({ count: deleted.passwordResetToken }) },
    emailVerificationToken: { deleteMany: vi.fn().mockResolvedValue({ count: deleted.emailVerificationToken }) },
    emailChangeRequest: { deleteMany: vi.fn().mockResolvedValue({ count: deleted.emailChangeRequest }) },
  } as unknown as AuthCleanupClient;
  return { client, deleted };
}

describe('purgeExpiredAuthArtifacts', () => {
  it('deletes expired/idle sessions and expired or completed auth artifacts', async () => {
    const { client, deleted } = stubClient();
    const now = new Date('2026-11-20T12:00:00.000Z');

    await expect(purgeExpiredAuthArtifacts(client, now)).resolves.toEqual({
      deletedSessions: deleted.authSession,
      deletedResetTokens: deleted.passwordResetToken,
      deletedVerificationTokens: deleted.emailVerificationToken,
      deletedEmailChanges: deleted.emailChangeRequest,
    });

    const idleCutoff = new Date(now.getTime() - AUTH_SESSION_IDLE_TTL_MS);
    expect(client.authSession.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ expiresAt: { lte: now } }, { lastUsedAt: { lte: idleCutoff } }] },
    });
    expect(client.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } });
    expect(client.emailVerificationToken.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } });
    expect(client.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ expiresAt: { lte: now } }, { completedAt: { not: null } }] },
    });
  });
});
