import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import {
  acquireScryptSlot,
  AuthError,
  hashPassword,
  loginWithEmail,
  MAX_CONCURRENT_SCRYPT,
  releaseScryptSlot,
} from '../../src/modules/auth/service.js';

describe('scrypt concurrency semaphore & bounded queue (C-4)', () => {
  it('fast-fails with 503 AUTH_BUSY when the waiter queue is full and recovers cleanly on release', async () => {
    for (let i = 0; i < MAX_CONCURRENT_SCRYPT; i += 1) {
      await acquireScryptSlot();
    }

    try {
      // Queue 1 waiter with maxQueue = 1 -> allowed to wait.
      const queued = acquireScryptSlot({ maxQueue: 1, timeoutMs: 2_000 });

      // A second waiter exceeds maxQueue = 1 -> rejected immediately with 503 AUTH_BUSY.
      await expect(
        acquireScryptSlot({ maxQueue: 1, timeoutMs: 2_000 }),
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 503 &&
          err.code === 'AUTH_BUSY',
      );

      // Releasing one active slot hands it directly to the queued waiter.
      releaseScryptSlot();
      await expect(queued).resolves.toBeUndefined();
    } finally {
      for (let i = 0; i < MAX_CONCURRENT_SCRYPT; i += 1) {
        releaseScryptSlot();
      }
    }
  });

  it('rejects a queued waiter with 503 AUTH_BUSY when the acquire timeout expires without leaking slots', async () => {
    for (let i = 0; i < MAX_CONCURRENT_SCRYPT; i += 1) {
      await acquireScryptSlot();
    }

    try {
      await expect(
        acquireScryptSlot({ maxQueue: 5, timeoutMs: 25 }),
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 503 &&
          err.code === 'AUTH_BUSY',
      );
    } finally {
      for (let i = 0; i < MAX_CONCURRENT_SCRYPT; i += 1) {
        releaseScryptSlot();
      }
    }

    // Verify all slots were cleanly released and can be acquired again.
    for (let i = 0; i < MAX_CONCURRENT_SCRYPT; i += 1) {
      await acquireScryptSlot({ timeoutMs: 25 });
    }
    for (let i = 0; i < MAX_CONCURRENT_SCRYPT; i += 1) {
      releaseScryptSlot();
    }
  });
});

describe('atomic failed-login lockout counter (C-4)', () => {
  it('records failed logins via atomic $executeRaw UPDATE instead of stale user.update', async () => {
    const passwordHash = await hashPassword('correct horse battery');
    const executeRaw = vi.fn().mockResolvedValue(1);
    const userUpdate = vi.fn();
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'lockout@example.test',
          passwordHash,
          googleSub: null,
          displayName: 'Explorer',
          emailVerifiedAt: new Date(),
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          lockedUntil: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: userUpdate,
      },
      $executeRaw: executeRaw,
    } as unknown as PrismaClient;

    await expect(
      loginWithEmail(db, {
        email: 'lockout@example.test',
        password: 'wrong password value',
      }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
