import './helpers/env.js'; // first: sets DATABASE_URL before any db/prisma import
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { buildApp } from '../../src/app.js';
import { ensureDatabaseUrl, runMigrations, teardownDatabase } from './helpers/database.js';
import { prisma } from '../../src/db/prisma.js';

/**
 * Regression test: `@fastify/rate-limit` must be awaited before registering
 * routes so per-route `config.rateLimit` options take effect on real requests.
 * This exercises the full `buildApp()` wiring end to end.
 */
describe('rate limiting (integration)', () => {
  let app: FastifyInstance;
  let db: PrismaClient;

  beforeAll(async () => {
    const url = ensureDatabaseUrl();
    runMigrations(url);
    process.env.LOG_LEVEL ??= 'silent';
    app = await buildApp();
    db = prisma;
  });

  afterAll(async () => {
    await app.close();
    await teardownDatabase(db);
  });

  it('POST /api/lobbies returns 429 (RATE_LIMITED) after the configured limit', async () => {
    const responses = [];
    for (let i = 0; i < 61; i += 1) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/api/lobbies',
          payload: { difficulty: 'easy' },
        }),
      );
    }

    const statuses = responses.map((res) => res.statusCode);
    expect(statuses.slice(0, 60)).toEqual(Array(60).fill(201));
    expect(statuses[60]).toBe(429);
    expect(responses[60]?.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
  });

  it('GET /api/health and GET /api/ready are exempt from rate limiting', async () => {
    for (let i = 0; i < 40; i += 1) {
      const health = await app.inject({ method: 'GET', url: '/api/health' });
      expect(health.statusCode).toBe(200);
      expect(health.headers['x-ratelimit-limit']).toBeUndefined();
    }
    const ready = await app.inject({ method: 'GET', url: '/api/ready' });
    expect(ready.statusCode).toBe(200);
    expect(ready.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('GET /api/lobbies/:code is covered by rate limiting', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/lobbies/AAAAAA' });
    expect(res.statusCode).toBe(404);
    expect(Number(res.headers['x-ratelimit-limit'])).toBeGreaterThan(0);
  });
});
