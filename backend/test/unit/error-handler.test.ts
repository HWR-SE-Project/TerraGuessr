import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { Type } from '@sinclair/typebox';

import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { AppError } from '../../src/plugins/errors.js';

function buildApp() {
  const app = Fastify({ logger: { level: 'silent' } });
  registerErrorHandler(app);
  return app;
}

describe('error handler envelope (ADR-0009)', () => {
  const cases: Array<[number, string]> = [
    [400, 'VALIDATION_ERROR'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [429, 'RATE_LIMITED'],
    [503, 'SERVICE_UNAVAILABLE'],
  ];

  for (const [status, code] of cases) {
    it(`maps an AppError(${status}) to code "${code}" with the real message`, async () => {
      const app = buildApp();
      app.get('/boom', async () => {
        throw new AppError(status, 'something specific happened');
      });

      try {
        const res = await app.inject({ method: 'GET', url: '/boom' });
        expect(res.statusCode).toBe(status);
        expect(res.json()).toEqual({
          error: { code, message: 'something specific happened' },
        });
      } finally {
        await app.close();
      }
    });
  }

  it('preserves explicit AppError machine codes (including actionable 503 codes)', async () => {
    const app = buildApp();
    app.get('/boom', async () => {
      throw new AppError(503, 'Weather is temporarily unavailable', 'WEATHER_UNAVAILABLE');
    });

    try {
      const res = await app.inject({ method: 'GET', url: '/boom' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({
        error: {
          code: 'WEATHER_UNAVAILABLE',
          message: 'Weather is temporarily unavailable',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('returns 400 VALIDATION_ERROR with details for Fastify schema validation errors', async () => {
    const app = buildApp();
    app.post(
      '/validate',
      { schema: { body: Type.Object({ count: Type.Integer() }) } },
      async () => ({ ok: true }),
    );

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/validate',
        payload: { count: 'not-a-number' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR', details: expect.any(Array) },
      });
    } finally {
      await app.close();
    }
  });

  it('masks unhandled Prisma, Node, Fastify, and upstream 5xx errors as 500 INTERNAL_ERROR without leaking codes', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found.',
      { code: 'P2025', clientVersion: '5.22.0' },
    );
    const networkError = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    const upstreamBadGateway = Object.assign(new Error('upstream HTML gateway error'), {
      statusCode: 502,
      code: 'FST_ERR_UPSTREAM',
    });
    const genericError = new Error('leaked stack trace detail');

    for (const thrown of [prismaError, networkError, upstreamBadGateway, genericError]) {
      const app = buildApp();
      app.get('/boom', async () => {
        throw thrown;
      });

      try {
        const res = await app.inject({ method: 'GET', url: '/boom' });
        expect(res.statusCode).toBe(500);
        expect(res.json()).toEqual({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        });
      } finally {
        await app.close();
      }
    }
  });

  it('maps non-AppError 4xx (e.g., rate-limit 429) without leaking internal error codes', async () => {
    const app = buildApp();
    app.get('/limited', async () => {
      throw Object.assign(new Error('Rate limit exceeded, retry in 1 minute'), {
        statusCode: 429,
        code: 'FST_ERR_RATE_LIMIT',
      });
    });

    try {
      const res = await app.inject({ method: 'GET', url: '/limited' });
      expect(res.statusCode).toBe(429);
      expect(res.json()).toEqual({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('logs 4xx errors at warn and >= 500 errors at error', async () => {
    const app = buildApp();
    const warnSpy = vi.fn();
    const errorSpy = vi.fn();
    app.addHook('onRequest', async (request) => {
      request.log.warn = warnSpy;
      request.log.error = errorSpy;
    });
    app.get('/client-err', async () => {
      throw new AppError(404, 'Not found');
    });
    app.get('/server-err', async () => {
      throw new Error('boom');
    });

    try {
      const r404 = await app.inject({ method: 'GET', url: '/client-err' });
      expect(r404.statusCode).toBe(404);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();

      const r500 = await app.inject({ method: 'GET', url: '/server-err' });
      expect(r500.statusCode).toBe(500);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
