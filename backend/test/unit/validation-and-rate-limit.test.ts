import { beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { buildApp } from '../../src/app.js';
import type { Env } from '../../src/config/env.js';
import { RATE_LIMITS } from '../../src/config/constants.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { createStrictBodySchemaController } from '../../src/plugins/validation.js';
import { registerAuthRoutes } from '../../src/modules/auth/routes.js';
import { hashSecret } from '../../src/modules/auth/service.js';
import { SESSION_COOKIE_NAME } from '../../src/modules/auth/cookies.js';
import { registerLobbiesRoutes } from '../../src/modules/lobbies/routes.js';
import { registerSingleplayerRoutes } from '../../src/modules/singleplayer/routes.js';

function baseEnv(): Env {
  return {
    databaseUrl: 'postgresql://user:pass@localhost:5432/test',
    nodeEnv: 'test',
    port: 3000,
    corsOrigin: false,
    openMeteoBaseUrl: 'https://api.open-meteo.com',
    logLevel: 'silent',
    sessionCookieSecure: false,
    trustProxy: false,
  };
}

describe('PATCH /api/auth/profile displayName validation (M-5)', () => {
  function authDb(updateMock = vi.fn()) {
    const rawToken = 'valid-session-token';
    const user = {
      id: 'user-1',
      email: 'explorer@example.test',
      passwordHash: 'hash',
      googleSub: null,
      displayName: 'Explorer',
      emailVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = {
      authSession: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { tokenHash: string } }) =>
          where.tokenHash === hashSecret(rawToken)
            ? {
                id: 'sess-1',
                userId: user.id,
                tokenHash: where.tokenHash,
                expiresAt: new Date(Date.now() + 60_000),
                lastUsedAt: new Date(),
                createdAt: new Date(),
                user,
              }
            : null,
        ),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      user: {
        update: updateMock.mockImplementation(async ({ data }: { data: { displayName: string } }) => ({
          ...user,
          displayName: data.displayName,
        })),
      },
    } as unknown as PrismaClient;
    return { db, cookie: `${SESSION_COOKIE_NAME}=${rawToken}`, updateMock };
  }

  it('rejects whitespace-only and too-short trimmed displayName values with 400', async () => {
    const { db, cookie, updateMock } = authDb();
    const app = Fastify({
      logger: { level: 'silent' },
      schemaController: createStrictBodySchemaController(),
    });
    registerErrorHandler(app);
    registerAuthRoutes(app, { config: baseEnv(), db });

    try {
      for (const displayName of ['   ', '  a  ', '\t\n  ']) {
        const res = await app.inject({
          method: 'PATCH',
          url: '/api/auth/profile',
          headers: { cookie },
          payload: { displayName },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({
          error: { code: 'VALIDATION_ERROR' },
        });
      }
      expect(updateMock).not.toHaveBeenCalled();

      const valid = await app.inject({
        method: 'PATCH',
        url: '/api/auth/profile',
        headers: { cookie },
        payload: { displayName: '  Atlas  ' },
      });
      expect(valid.statusCode).toBe(200);
      expect(valid.json().user.displayName).toBe('Atlas');
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { displayName: 'Atlas' },
      });
    } finally {
      await app.close();
    }
  });
});

describe('Strict JSON body validation (coerceTypes: false on body, kept on params/query)', () => {
  it('rejects { lat: null, lon: null } and string coordinates on lobby /guess and /selection while still coercing :roundNumber', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = { lobby: { findUnique } } as unknown as PrismaClient;
    const app = Fastify({
      logger: { level: 'silent' },
      schemaController: createStrictBodySchemaController(),
    });
    registerErrorHandler(app);
    registerLobbiesRoutes(app, db);

    try {
      for (const payload of [
        { lat: null, lon: null },
        { lat: null, lon: 0 },
        { lat: '48.8', lon: 2.35 },
      ]) {
        const guessRes = await app.inject({
          method: 'POST',
          url: '/api/lobbies/ABC234/rounds/1/guess',
          headers: { 'x-lobby-token': 'tok' },
          payload,
        });
        expect(guessRes.statusCode).toBe(400);
        expect(guessRes.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

        const selRes = await app.inject({
          method: 'POST',
          url: '/api/lobbies/ABC234/selection',
          headers: { 'x-lobby-token': 'tok' },
          payload,
        });
        expect(selRes.statusCode).toBe(400);
        expect(selRes.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      }

      // Valid numeric body + string path param `:roundNumber` ("1") passes schema validation
      // and reaches the handler (which returns 404 because mocked lobby is null).
      const validReq = await app.inject({
        method: 'POST',
        url: '/api/lobbies/ABC234/rounds/1/guess',
        headers: { 'x-lobby-token': 'tok' },
        payload: { lat: 48.8566, lon: 2.3522 },
      });
      expect(validReq.statusCode).toBe(404);
      expect(findUnique).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('validates POST /api/singleplayer/games body schema and rejects null coords on PUT selection', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'game-1' });
    const db = {
      streetGame: { create, findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;
    const app = Fastify({
      logger: { level: 'silent' },
      schemaController: createStrictBodySchemaController(),
    });
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, { db });

    try {
      const invalidDiff = await app.inject({
        method: 'POST',
        url: '/api/singleplayer/games',
        payload: { difficulty: 'expert' },
      });
      expect(invalidDiff.statusCode).toBe(400);
      expect(invalidDiff.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

      const emptyBody = await app.inject({
        method: 'POST',
        url: '/api/singleplayer/games',
      });
      expect(emptyBody.statusCode).toBe(201);

      const emptyObj = await app.inject({
        method: 'POST',
        url: '/api/singleplayer/games',
        payload: {},
      });
      expect(emptyObj.statusCode).toBe(201);

      const validDiff = await app.inject({
        method: 'POST',
        url: '/api/singleplayer/games',
        payload: { difficulty: 'hard' },
      });
      expect(validDiff.statusCode).toBe(201);

      const nullSel = await app.inject({
        method: 'PUT',
        url: '/api/singleplayer/games/game-1/rounds/round-1/selection',
        headers: { 'x-player-token': 'tok' },
        payload: { lat: null, lon: null },
      });
      expect(nullSel.statusCode).toBe(400);
      expect(nullSel.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await app.close();
    }
  });
});

describe('Global baseline rate limiting (H-4)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/terraguessr_test';
    process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
  });

  it('enforces rate limits on previously unprotected routes while exempting /api/health and /api/ready', async () => {
    const readyDb = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const app = await buildApp({ readyDb });

    try {
      // Previously unprotected GET /api/lobbies/:code now carries RATE_LIMITS.poll (180/min)
      // and returns 429 RATE_LIMITED once the budget is exhausted (invalid code format avoids DB).
      let lastLobbyRes;
      for (let i = 0; i <= RATE_LIMITS.poll.max; i += 1) {
        lastLobbyRes = await app.inject({
          method: 'GET',
          url: '/api/lobbies/invalid',
        });
      }
      expect(lastLobbyRes!.statusCode).toBe(429);
      expect(lastLobbyRes!.json()).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      });

      // Previously unprotected GET /api/auth/google carries explicit 20/min rate limit.
      let lastGoogleRes;
      for (let i = 0; i <= 20; i += 1) {
        lastGoogleRes = await app.inject({
          method: 'GET',
          url: '/api/auth/google',
        });
      }
      expect(lastGoogleRes!.statusCode).toBe(429);
      expect(lastGoogleRes!.json()).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      });

      // Global default applies to routes without explicit config.rateLimit (e.g. /api/game-rules).
      const rulesRes = await app.inject({ method: 'GET', url: '/api/game-rules' });
      expect(rulesRes.statusCode).toBe(200);
      expect(Number(rulesRes.headers['x-ratelimit-limit'])).toBe(
        RATE_LIMITS.globalDefault.max,
      );

      // /api/health and /api/ready are explicitly exempt (no rate-limit headers, never 429).
      for (let i = 0; i < 5; i += 1) {
        const health = await app.inject({ method: 'GET', url: '/api/health' });
        expect(health.statusCode).toBe(200);
        expect(health.headers['x-ratelimit-limit']).toBeUndefined();

        const ready = await app.inject({ method: 'GET', url: '/api/ready' });
        expect(ready.statusCode).toBe(200);
        expect(ready.headers['x-ratelimit-limit']).toBeUndefined();
      }
    } finally {
      await app.close();
    }
  });
});
