import './helpers/env.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../src/config/env.js';
import { registerAuthRoutes } from '../../src/modules/auth/routes.js';
import { registerGamesRoutes } from '../../src/modules/games/routes.js';
import { registerRoundsRoutes } from '../../src/modules/rounds/routes.js';
import { registerStatisticsRoutes } from '../../src/modules/statistics/routes.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { setupDatabase, StubWeatherClient, teardownDatabase } from './helpers/database.js';

describe('account statistics (integration)', () => {
  let db: PrismaClient;
  let app: FastifyInstance;
  beforeAll(async () => {
    db = await setupDatabase();
    app = Fastify({ logger: { level: 'silent' } });
    registerErrorHandler(app);
    const config: Env = { databaseUrl: process.env.DATABASE_URL!, nodeEnv: 'test', port: 3000, corsOrigin: false, adminApiToken: '', openMeteoBaseUrl: 'https://api.open-meteo.com', logLevel: 'silent', sessionCookieSecure: false, trustProxy: false };
    registerAuthRoutes(app, { db, config });
    registerGamesRoutes(app, db);
    registerRoundsRoutes(app, db, new StubWeatherClient());
    registerStatisticsRoutes(app, db);
  });
  afterAll(async () => { await app.close(); await teardownDatabase(db); });

  it('aggregates persisted Solo results, paginates history, and leaves unsupported modes empty', async () => {
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `stats-${Date.now()}@example.test`, displayName: 'Stats Reader', password: 'correct horse battery' } });
    const cookie = String(registration.headers['set-cookie']).split(';')[0]!;
    const gameResponse = await app.inject({ method: 'POST', url: '/api/games', headers: { cookie }, payload: { mode: 'solo', difficulty: 'hard', roundsTotal: 1 } });
    const { gameId, playerToken } = gameResponse.json() as { gameId: string; playerToken: string };
    const started = await app.inject({ method: 'POST', url: `/api/games/${gameId}/rounds`, headers: { 'x-player-token': playerToken }, payload: { selectionMode: 'map' } });
    const roundId = started.json().roundId as string;
    const actual = await db.round.findUniqueOrThrow({ where: { id: roundId }, include: { location: true } });
    const submitted = await app.inject({ method: 'POST', url: `/api/rounds/${roundId}/guess`, headers: { 'x-player-token': playerToken }, payload: { lat: actual.location.lat, lon: actual.location.lon } });
    expect(submitted.statusCode).toBe(200);

    const stats = await app.inject({ url: '/api/statistics?mode=solo&limit=1&offset=0', headers: { cookie } });
    expect(stats.statusCode).toBe(200);
    expect(stats.json()).toMatchObject({ mode: 'solo', total: 1, averageScore: 5000, averageDistanceKm: 0 });
    expect(stats.json().entries[0]).toMatchObject({ score: 5000, distanceKm: 0, actual: { lat: actual.location.lat, lon: actual.location.lon } });
    const laterPage = await app.inject({ url: '/api/statistics?mode=solo&limit=1&offset=1', headers: { cookie } });
    expect(laterPage.json()).toMatchObject({ total: 1, offset: 1, entries: [] });
    expect((await app.inject({ url: '/api/statistics?mode=ranked', headers: { cookie } })).json()).toMatchObject({ mode: 'ranked', available: false, total: 0, entries: [] });
    expect((await app.inject({ url: '/api/statistics?mode=solo' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/statistics?mode=unknown', headers: { cookie } })).statusCode).toBe(400);
  });
});
