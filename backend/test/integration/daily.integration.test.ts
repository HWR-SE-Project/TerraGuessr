import './helpers/env.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { registerAuthRoutes } from '../../src/modules/auth/routes.js';
import { registerDailyRoutes } from '../../src/modules/daily/routes.js';
import { setupDatabase, StubWeatherClient, teardownDatabase } from './helpers/database.js';

describe('Daily Challenge (integration)', () => {
  let db: PrismaClient;
  let app: FastifyInstance;
  beforeAll(async () => {
    db = await setupDatabase();
    app = Fastify({ logger: { level: 'silent' } });
    registerErrorHandler(app);
    const config = { databaseUrl: process.env.DATABASE_URL!, port: 3000, corsOrigin: false as const, adminApiToken: '', openMeteoBaseUrl: 'https://api.open-meteo.com', logLevel: 'silent', sessionCookieSecure: false };
    registerAuthRoutes(app, { db, config });
    registerDailyRoutes(app, { db, config, weatherClient: new StubWeatherClient() });
  });
  afterAll(async () => { await app.close(); await teardownDatabase(db); });

  async function player(displayName: string) {
    const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `daily-${Date.now()}-${Math.random()}@example.test`, displayName, password: 'correct horse battery' } });
    expect(response.statusCode).toBe(201);
    return String(response.headers['set-cookie']).split(';')[0]!;
  }

  it('shares one UTC challenge, hides its answer before submission, prevents repeats, and ranks persisted results', async () => {
    const ada = await player('Ada');
    const lin = await player('Lin');
    const [first, second] = await Promise.all([
      app.inject({ url: '/api/daily/today', headers: { cookie: ada } }),
      app.inject({ url: '/api/daily/today', headers: { cookie: lin } }),
    ]);
    expect(first.statusCode).toBe(200);
    expect(second.json().date).toBe(first.json().date);
    expect(first.json().status).toBe('open');
    expect(first.json().round.weather.temperatureC).toBeTypeOf('number');
    expect(JSON.stringify(first.json())).not.toMatch(/actualLat|actualLon|"actual"|locationId/);
    const before = await db.dailySubmission.count({ where: { date: first.json().date } });
    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/daily/today/guess', headers: { cookie: ada }, payload: { lat: 52.52, lon: 13.405 } }),
      app.inject({ method: 'POST', url: '/api/daily/today/guess', headers: { cookie: lin }, payload: { lat: -15, lon: -60 } }),
    ]);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(a.json().result.actual).toEqual(b.json().result.actual);
    expect((await app.inject({ method: 'POST', url: '/api/daily/today/guess', headers: { cookie: ada }, payload: { lat: 0, lon: 0 } })).statusCode).toBe(409);
    const board = await app.inject({ url: `/api/daily/${first.json().date}/leaderboard?limit=1`, headers: { cookie: ada } });
    expect(board.statusCode).toBe(200);
    expect(board.json().total).toBe(before + 2);
    expect(board.json().myRank).toBeGreaterThanOrEqual(1);
    expect(board.json().myRank).toBeLessThanOrEqual(before + 2);
    expect(board.json().entries).toHaveLength(1);
    const reopened = await app.inject({ url: '/api/daily/today', headers: { cookie: ada } });
    expect(reopened.json().status).toBe('completed');
    expect(reopened.json().result.actual).toEqual(a.json().result.actual);
  });

  it('requires a signed-in account for challenge and leaderboard', async () => {
    expect((await app.inject({ url: '/api/daily/today' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/daily/2026-01-01/leaderboard' })).statusCode).toBe(401);
  });
});
