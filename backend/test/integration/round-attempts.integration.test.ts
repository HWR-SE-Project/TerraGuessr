import './helpers/env.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { registerGamesRoutes } from '../../src/modules/games/routes.js';
import { registerRoundsRoutes } from '../../src/modules/rounds/routes.js';
import { registerResultsRoutes } from '../../src/modules/results/routes.js';
import { StubWeatherClient, setupDatabase, teardownDatabase } from './helpers/database.js';

describe('multi-attempt rounds (integration)', () => {
  let db: PrismaClient;
  let app: FastifyInstance;
  beforeAll(async () => {
    db = await setupDatabase();
    app = Fastify({ logger: { level: 'silent' } });
    registerErrorHandler(app);
    registerGamesRoutes(app, db);
    registerRoundsRoutes(app, db, new StubWeatherClient());
    registerResultsRoutes(app, db);
  });
  afterAll(async () => { await app.close(); await teardownDatabase(db); });

  async function makeRound(attemptsPerRound: number) {
    const created = await app.inject({ method: 'POST', url: '/api/games', payload: { mode: 'solo', difficulty: 'hard', roundsTotal: 1, attemptsPerRound } });
    expect(created.statusCode).toBe(201);
    const game = created.json() as { gameId: string; playerToken: string; attemptsPerRound: number };
    const started = await app.inject({ method: 'POST', url: `/api/games/${game.gameId}/rounds`, headers: { 'x-player-token': game.playerToken }, payload: { selectionMode: 'map' } });
    expect(started.statusCode).toBe(201);
    return { game, round: started.json() as { roundId: string; attemptsTotal: number } };
  }

  it('keeps intermediate feedback answer-safe and finishes with the best saved guess', async () => {
    const { game, round } = await makeRound(3);
    expect(round.attemptsTotal).toBe(3);
    const owner = { 'x-player-token': game.playerToken };
    const actual = await db.round.findUniqueOrThrow({ where: { id: round.roundId }, include: { location: true } });
    const first = await app.inject({ method: 'POST', url: `/api/rounds/${round.roundId}/attempts`, headers: owner, payload: { lat: 0, lon: 0 } });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ attemptNumber: 1, attemptsTotal: 3, attemptsRemaining: 2, result: null });
    expect(JSON.stringify(first.json())).not.toMatch(/actualLat|actualLon|"actual"/);
    const blockedLegacy = await app.inject({ method: 'POST', url: `/api/rounds/${round.roundId}/guess`, headers: owner, payload: { lat: 0, lon: 0 } });
    expect(blockedLegacy.statusCode).toBe(409);
    const second = await app.inject({ method: 'POST', url: `/api/rounds/${round.roundId}/attempts`, headers: owner, payload: { lat: actual.location.lat, lon: actual.location.lon } });
    expect(second.json()).toMatchObject({ attemptNumber: 2, attemptsRemaining: 1, result: null });
    const finished = await app.inject({ method: 'POST', url: `/api/rounds/${round.roundId}/finish`, headers: owner, payload: {} });
    expect(finished.statusCode).toBe(200);
    expect(finished.json()).toMatchObject({ distanceKm: 0, score: 5000, actual: { lat: actual.location.lat, lon: actual.location.lon } });
    expect((await db.round.findUniqueOrThrow({ where: { id: round.roundId } })).status).toBe('completed');
    expect((await db.game.findUniqueOrThrow({ where: { id: game.gameId } })).status).toBe('completed');
    expect((await app.inject({ method: 'POST', url: `/api/rounds/${round.roundId}/attempts`, headers: owner, payload: { lat: 0, lon: 0 } })).statusCode).toBe(409);
  });

  it('finalizes automatically on the last configured attempt and validates the 1–5 bound', async () => {
    const badLow = await app.inject({ method: 'POST', url: '/api/games', payload: { mode: 'solo', difficulty: 'easy', attemptsPerRound: 0 } });
    const badHigh = await app.inject({ method: 'POST', url: '/api/games', payload: { mode: 'solo', difficulty: 'easy', attemptsPerRound: 6 } });
    expect(badLow.statusCode).toBe(400);
    expect(badHigh.statusCode).toBe(400);
    const { game, round } = await makeRound(2);
    const headers = { 'x-player-token': game.playerToken };
    await app.inject({ method: 'POST', url: `/api/rounds/${round.roundId}/attempts`, headers, payload: { lat: 1, lon: 1 } });
    const last = await app.inject({ method: 'POST', url: `/api/rounds/${round.roundId}/attempts`, headers, payload: { lat: 2, lon: 2 } });
    expect(last.statusCode).toBe(200);
    expect(last.json().attemptsRemaining).toBe(0);
    expect(last.json().result.actual).toBeTruthy();
    expect(await db.roundAttempt.count({ where: { roundId: round.roundId } })).toBe(2);
  });

  it('serializes simultaneous finish requests so only one result is created', async () => {
    const { game, round } = await makeRound(3);
    const headers = { 'x-player-token': game.playerToken };
    await app.inject({ method: 'POST', url: `/api/rounds/${round.roundId}/attempts`, headers, payload: { lat: 10, lon: 10 } });
    const finish = () => app.inject({ method: 'POST', url: `/api/rounds/${round.roundId}/finish`, headers, payload: {} });
    const responses = await Promise.all([finish(), finish()]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(await db.result.count({ where: { roundId: round.roundId } })).toBe(1);
  });
});
