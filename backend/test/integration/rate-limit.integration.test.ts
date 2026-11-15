import './helpers/env.js'; // first: sets DATABASE_URL before any db/prisma import
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { buildApp } from '../../src/app.js';
import { ensureDatabaseUrl, runMigrations, teardownDatabase } from './helpers/database.js';
import { prisma } from '../../src/db/prisma.js';

/**
 * Phase C regression: `@fastify/rate-limit` was registered fire-and-forget
 * (`void app.register(...)`), so routes declared synchronously right after
 * never saw its per-route `config.rateLimit` option — the limiter silently
 * did nothing on every real request. This exercises the actual production
 * wiring (buildApp(), not a bare test Fastify instance) end to end.
 */
describe('rate limiting (integration, Phase C)', () => {
  let app: FastifyInstance;
  let db: PrismaClient;

  beforeAll(async () => {
    const url = ensureDatabaseUrl();
    runMigrations(url);
    process.env.ADMIN_API_TOKEN ??= 'test-admin-token';
    process.env.LOG_LEVEL ??= 'silent';
    app = await buildApp();
    db = prisma;
  });

  afterAll(async () => {
    await app.close();
    await teardownDatabase(db);
  });

  it('POST /api/games returns 429 (RATE_LIMITED) after the configured limit', async () => {
    const responses = [];
    for (let i = 0; i < 31; i += 1) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/api/games',
          payload: { mode: 'solo', difficulty: 'easy' },
        }),
      );
    }

    const statuses = responses.map((res) => res.statusCode);
    expect(statuses.slice(0, 30)).toEqual(Array(30).fill(201));
    expect(statuses[30]).toBe(429);
    expect(responses[30]?.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
  });

  it('GET /api/health is not rate-limited (no config.rateLimit on that route)', async () => {
    for (let i = 0; i < 40; i += 1) {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
    }
  });
});
