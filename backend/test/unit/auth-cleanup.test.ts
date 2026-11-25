import { describe, expect, it, vi } from 'vitest';
import {
  AUTH_CLEANUP_BATCH_SIZE,
  purgeExpiredAuthArtifacts,
} from '../../src/scheduler/authCleanup.js';
import type { AuthCleanupClient } from '../../src/scheduler/authCleanup.js';

describe('purgeExpiredAuthArtifacts (batched SKIP LOCKED)', () => {
  it('deletes expired/idle sessions and expired/completed auth artifacts in bounded batches', async () => {
    const now = new Date('2026-11-20T12:00:00.000Z');
    const callsByTable: Record<string, number> = {};
    const executeRaw = vi.fn().mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      if (sql.includes('"AuthSession"')) {
        callsByTable.AuthSession = (callsByTable.AuthSession ?? 0) + 1;
        return callsByTable.AuthSession === 1 ? AUTH_CLEANUP_BATCH_SIZE : 2;
      }
      if (sql.includes('"PasswordResetToken"')) {
        callsByTable.PasswordResetToken = (callsByTable.PasswordResetToken ?? 0) + 1;
        return 3;
      }
      if (sql.includes('"EmailVerificationToken"')) {
        callsByTable.EmailVerificationToken = (callsByTable.EmailVerificationToken ?? 0) + 1;
        return 4;
      }
      if (sql.includes('"EmailChangeRequest"')) {
        callsByTable.EmailChangeRequest = (callsByTable.EmailChangeRequest ?? 0) + 1;
        return 5;
      }
      return 0;
    });
    const client = { $executeRaw: executeRaw } as unknown as AuthCleanupClient;

    await expect(purgeExpiredAuthArtifacts(client, now)).resolves.toEqual({
      deletedSessions: AUTH_CLEANUP_BATCH_SIZE + 2,
      deletedResetTokens: 3,
      deletedVerificationTokens: 4,
      deletedEmailChanges: 5,
    });

    expect(callsByTable.AuthSession).toBe(2);
    expect(callsByTable.PasswordResetToken).toBe(1);
    expect(callsByTable.EmailVerificationToken).toBe(1);
    expect(callsByTable.EmailChangeRequest).toBe(1);
    for (const call of executeRaw.mock.calls) {
      const sql = (call[0] as TemplateStringsArray).join(' ');
      expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    }
  });
});
