import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

import type { Env } from '../../src/config/env.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { createGoogleFlowState, OAUTH_COOKIE_NAME } from '../../src/modules/auth/cookies.js';
import {
  registerAuthRoutes,
  type GoogleOAuthClientLike,
} from '../../src/modules/auth/routes.js';
import { AuthError, requestEmailChange } from '../../src/modules/auth/service.js';

const GOOGLE_SECRET = 'test-google-client-secret';

function googleEnv(): Env {
  return {
    databaseUrl: 'postgresql://user:pass@localhost:5432/test',
    nodeEnv: 'test',
    port: 3000,
    corsOrigin: false,
    openMeteoBaseUrl: 'https://api.open-meteo.com',
    logLevel: 'silent',
    googleClientId: 'test-client-id',
    googleClientSecret: GOOGLE_SECRET,
    googleRedirectUri: 'http://localhost:3000/api/auth/google/callback',
    appBaseUrl: 'http://localhost:8080',
    sessionCookieSecure: false,
    trustProxy: false,
  };
}

function buildTestApp(options: {
  client: GoogleOAuthClientLike;
  db?: PrismaClient;
  googleTimeoutMs?: number;
}) {
  const app = Fastify({ logger: { level: 'silent' } });
  registerErrorHandler(app);
  registerAuthRoutes(app, {
    config: googleEnv(),
    db: options.db ?? ({} as unknown as PrismaClient),
    googleClientFactory: () => options.client,
    googleTimeoutMs: options.googleTimeoutMs,
  });
  return app;
}

function createFlowRequest() {
  const { state, cookieValue } = createGoogleFlowState(GOOGLE_SECRET);
  return {
    state,
    cookie: `${OAUTH_COOKIE_NAME}=${cookieValue}`,
    url: `/api/auth/google/callback?state=${encodeURIComponent(state.state)}&code=auth-code-123`,
  };
}

describe('GET /api/auth/google/callback error handling', () => {
  it('maps invalid_grant / 4xx getToken errors to 401 GOOGLE_AUTH_FAILED without leaking raw errors', async () => {
    const gaxiosErr = Object.assign(new Error('invalid_grant: Bad Request'), {
      response: { status: 400, data: { error: 'invalid_grant' } },
      code: 'ERR_BAD_REQUEST',
    });
    const client = {
      generateAuthUrl: vi.fn(),
      getToken: vi.fn().mockRejectedValue(gaxiosErr),
      verifyIdToken: vi.fn(),
    } as unknown as GoogleOAuthClientLike;
    const app = buildTestApp({ client });

    try {
      const flow = createFlowRequest();
      const res = await app.inject({
        method: 'GET',
        url: flow.url,
        headers: { cookie: flow.cookie },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        error: {
          code: 'GOOGLE_AUTH_FAILED',
          message: 'Google sign-in could not be verified',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('maps network / 5xx getToken failures to 503 GOOGLE_AUTH_UNAVAILABLE', async () => {
    const netErr = Object.assign(new Error('connect ECONNREFUSED 142.250.0.1:443'), {
      code: 'ECONNREFUSED',
    });
    const client = {
      generateAuthUrl: vi.fn(),
      getToken: vi.fn().mockRejectedValue(netErr),
      verifyIdToken: vi.fn(),
    } as unknown as GoogleOAuthClientLike;
    const app = buildTestApp({ client });

    try {
      const flow = createFlowRequest();
      const res = await app.inject({
        method: 'GET',
        url: flow.url,
        headers: { cookie: flow.cookie },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({
        error: {
          code: 'GOOGLE_AUTH_UNAVAILABLE',
          message: 'Google sign-in is temporarily unavailable',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('maps getToken timeouts to 503 GOOGLE_AUTH_UNAVAILABLE', async () => {
    const client = {
      generateAuthUrl: vi.fn(),
      getToken: vi.fn().mockImplementation(() => new Promise(() => {})),
      verifyIdToken: vi.fn(),
    } as unknown as GoogleOAuthClientLike;
    const app = buildTestApp({ client, googleTimeoutMs: 25 });

    try {
      const flow = createFlowRequest();
      const res = await app.inject({
        method: 'GET',
        url: flow.url,
        headers: { cookie: flow.cookie },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({
        error: { code: 'GOOGLE_AUTH_UNAVAILABLE' },
      });
    } finally {
      await app.close();
    }
  });

  it('maps invalid ID tokens in verifyIdToken to 401 GOOGLE_AUTH_FAILED', async () => {
    const client = {
      generateAuthUrl: vi.fn(),
      getToken: vi.fn().mockResolvedValue({ tokens: { id_token: 'bad.jwt.token' } }),
      verifyIdToken: vi.fn().mockRejectedValue(new Error('Token used too late')),
    } as unknown as GoogleOAuthClientLike;
    const app = buildTestApp({ client });

    try {
      const flow = createFlowRequest();
      const res = await app.inject({
        method: 'GET',
        url: flow.url,
        headers: { cookie: flow.cookie },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        error: {
          code: 'GOOGLE_AUTH_FAILED',
          message: 'Google sign-in could not be verified',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('maps verifyIdToken timeouts / upstream errors to 503 GOOGLE_AUTH_UNAVAILABLE', async () => {
    const client = {
      generateAuthUrl: vi.fn(),
      getToken: vi.fn().mockResolvedValue({ tokens: { id_token: 'valid.jwt.token' } }),
      verifyIdToken: vi.fn().mockImplementation(() => new Promise(() => {})),
    } as unknown as GoogleOAuthClientLike;
    const app = buildTestApp({ client, googleTimeoutMs: 25 });

    try {
      const flow = createFlowRequest();
      const res = await app.inject({
        method: 'GET',
        url: flow.url,
        headers: { cookie: flow.cookie },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({
        error: { code: 'GOOGLE_AUTH_UNAVAILABLE' },
      });
    } finally {
      await app.close();
    }
  });

  it('returns 409 only for P2002 unique violations on user.create and rethrows other DB errors', async () => {
    const flow = createFlowRequest();
    const validClient = {
      generateAuthUrl: vi.fn(),
      getToken: vi.fn().mockResolvedValue({ tokens: { id_token: 'good.jwt.token' } }),
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          nonce: flow.state.nonce,
          email_verified: true,
          sub: 'google-sub-1',
          email: 'explorer@example.test',
          name: 'Explorer',
        }),
      }),
    } as unknown as GoogleOAuthClientLike;

    // 1. Unique constraint violation (P2002) with no matching googleSub -> 409
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    const dbConflict = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(p2002),
      },
    } as unknown as PrismaClient;

    const appConflict = buildTestApp({ client: validClient, db: dbConflict });
    try {
      const res = await appConflict.inject({
        method: 'GET',
        url: flow.url,
        headers: { cookie: flow.cookie },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        error: { message: 'This Google account could not be connected' },
      });
    } finally {
      await appConflict.close();
    }

    // 2. Non-unique DB error -> rethrown (500 INTERNAL_ERROR, never masked as 409)
    const dbDown = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(new Error('database connection terminated')),
      },
    } as unknown as PrismaClient;

    const appDown = buildTestApp({ client: validClient, db: dbDown });
    try {
      const res = await appDown.inject({
        method: 'GET',
        url: flow.url,
        headers: { cookie: flow.cookie },
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    } finally {
      await appDown.close();
    }
  });

  it('redirects browser navigations (Accept: text/html) to /auth with mapped authError codes', async () => {
    const flow = createFlowRequest();
    const validClient = {
      generateAuthUrl: vi.fn(),
      getToken: vi.fn().mockResolvedValue({ tokens: { id_token: 'good.jwt.token' } }),
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          nonce: flow.state.nonce,
          email_verified: true,
          sub: 'google-sub-2',
          email: 'existing@example.test',
          name: 'Existing',
        }),
      }),
    } as unknown as GoogleOAuthClientLike;

    const dbExistingEmail = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'u-existing', email: 'existing@example.test' }),
      },
    } as unknown as PrismaClient;

    const app = buildTestApp({ client: validClient, db: dbExistingEmail });
    try {
      const cancelled = await app.inject({
        method: 'GET',
        url: `/api/auth/google/callback?state=${encodeURIComponent(flow.state.state)}&error=access_denied`,
        headers: { cookie: flow.cookie, accept: 'text/html,application/xhtml+xml' },
      });
      expect(cancelled.statusCode).toBe(302);
      expect(cancelled.headers.location).toBe('http://localhost:8080/auth?authError=google_cancelled');

      const conflict = await app.inject({
        method: 'GET',
        url: flow.url,
        headers: { cookie: flow.cookie, accept: 'text/html,application/xhtml+xml' },
      });
      expect(conflict.statusCode).toBe(302);
      expect(conflict.headers.location).toBe('http://localhost:8080/auth?authError=google_email_exists');
    } finally {
      await app.close();
    }
  });

  it('clears the OAuth flow cookie and sets the session cookie on successful sign-in', async () => {
    const flow = createFlowRequest();
    const validClient = {
      generateAuthUrl: vi.fn(),
      getToken: vi.fn().mockResolvedValue({ tokens: { id_token: 'good.jwt.token' } }),
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          nonce: flow.state.nonce,
          email_verified: true,
          sub: 'google-sub-ok',
          email: 'explorer@example.test',
          name: 'Explorer',
        }),
      }),
    } as unknown as GoogleOAuthClientLike;

    const dbOk = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u-ok',
          email: 'explorer@example.test',
          googleSub: 'google-sub-ok',
        }),
      },
      authSession: {
        create: vi.fn().mockResolvedValue({ id: 's-1' }),
      },
    } as unknown as PrismaClient;

    const app = buildTestApp({ client: validClient, db: dbOk });
    try {
      const res = await app.inject({
        method: 'GET',
        url: flow.url,
        headers: { cookie: flow.cookie, accept: 'text/html' },
      });
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('http://localhost:8080');
      const setCookies = Array.isArray(res.headers['set-cookie'])
        ? res.headers['set-cookie']
        : [String(res.headers['set-cookie'] ?? '')];
      expect(setCookies.some((c) => c.startsWith('tg_google_flow=;') && c.includes('Max-Age=0'))).toBe(true);
      expect(setCookies.some((c) => c.startsWith('tg_session=') && c.includes('HttpOnly'))).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('rejects email change requests for Google-only accounts', async () => {
    const db = {} as unknown as PrismaClient;
    const googleOnlyUser = {
      id: 'u-google',
      email: 'explorer@gmail.com',
      passwordHash: null,
      googleSub: 'google-sub-123',
      displayName: 'Explorer',
      emailVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await expect(
      requestEmailChange(db, googleOnlyUser, { newEmail: 'other@example.test' }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AuthError &&
        err.statusCode === 400 &&
        err.code === 'GOOGLE_MANAGED_EMAIL',
    );
  });
});
