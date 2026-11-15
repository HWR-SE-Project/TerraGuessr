import './helpers/env.js'; // first: sets DATABASE_URL before any db/prisma import
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import {
  StubWeatherClient,
  buildTestApp,
  findLeakedActualKeys,
  setupDatabase,
  teardownDatabase,
} from './helpers/database.js';

/**
 * API contract conformance (API-CONTRACTS.md, ADR-0010 drift guard).
 *
 * Every assertion below is transcribed verbatim from the frozen markdown. When
 * a response drifts from the documented shape (extra/missing fields, wrong
 * wrapper), this suite fails on purpose so the drift is fixed — either in the
 * backend or by a coordinated contract update, never silently.
 */

function sortedKeys(value: unknown): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value as Record<string, unknown>).sort();
}

function expectExactKeys(value: unknown, expected: readonly string[]): void {
  expect(sortedKeys(value)).toEqual([...expected].sort());
}

function expectFiniteNumber(value: unknown): void {
  expect(typeof value).toBe('number');
  expect(Number.isFinite(value)).toBe(true);
}

function expectErrorEnvelope(body: unknown, code: string): void {
  expectExactKeys(body, ['error']);
  const error = (body as { error: Record<string, unknown> }).error;
  expect(typeof error.code).toBe('string');
  expect(error.code).toBe(code);
  expect(typeof error.message).toBe('string');
  if (error.details !== undefined) {
    expect(typeof error.details).toBe('object');
  }
}

const WEATHER_KEYS = [
  'temperatureC',
  'precipitationMm',
  'humidityPct',
  'windSpeedKmh',
] as const;

const CANDIDATE_KEYS = ['id', 'name', 'lat', 'lon', 'region'] as const;

const LATLON_KEYS = ['lat', 'lon'] as const;

const RESULT_KEYS = [
  'resultId',
  'roundNumber',
  'distanceKm',
  'score',
  'actual',
  'guess',
  'createdAt',
] as const;

describe('API contract conformance (API-CONTRACTS.md)', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;

  beforeAll(async () => {
    prisma = await setupDatabase();
    app = buildTestApp(prisma, new StubWeatherClient());
  });

  afterAll(async () => {
    await app.close();
    await teardownDatabase(prisma);
  });

  async function createGame(
    difficulty: 'easy' | 'medium' | 'hard',
  ): Promise<{ gameId: string; playerToken: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { mode: 'solo', difficulty },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { gameId: string; playerToken: string };
  }

  it('POST /api/games -> 201 { gameId, playerToken, roundsTotal }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { mode: 'solo', difficulty: 'easy' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as Record<string, unknown>;
    expectExactKeys(body, ['gameId', 'playerToken', 'roundsTotal']);
    expect(typeof body.gameId).toBe('string');
    expect(typeof body.playerToken).toBe('string');
    expect(body.roundsTotal).toBe(5);
  });

  it('GET /api/games/:id -> 200 GameSummary', async () => {
    const { gameId, playerToken } = await createGame('easy');
    const res = await app.inject({
      method: 'GET',
      url: '/api/games/' + gameId,
      headers: { 'x-player-token': playerToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expectExactKeys(body, [
      'gameId',
      'mode',
      'difficulty',
      'status',
      'roundsPlayed',
      'roundsTotal',
      'currentRound',
    ]);
    expect(body.mode).toBe('solo');
    expect(body.difficulty).toBe('easy');
    expect(['active', 'completed']).toContain(body.status);
    expect(Number.isInteger(body.roundsPlayed)).toBe(true);
    expect(Number.isInteger(body.roundsTotal)).toBe(true);
    if (body.currentRound === null) {
      expect(body.currentRound).toBeNull();
    } else {
      expectExactKeys(body.currentRound, ['roundId', 'roundNumber', 'status']);
    }
  });

  it('POST /api/games/:id/rounds -> 201 RoundView (R04 holds)', async () => {
    const { gameId, playerToken } = await createGame('medium');
    const res = await app.inject({
      method: 'POST',
      url: '/api/games/' + gameId + '/rounds',
      headers: { 'x-player-token': playerToken },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as Record<string, unknown>;
    expectExactKeys(body, [
      'roundId',
      'roundNumber',
      'difficulty',
      'selectionMode',
      'weather',
      'candidates',
    ]);
    expect(typeof body.roundId).toBe('string');
    expect(Number.isInteger(body.roundNumber)).toBe(true);
    expect(['easy', 'medium', 'hard']).toContain(body.difficulty);
    expect(['map', 'list']).toContain(body.selectionMode);

    expectExactKeys(body.weather, WEATHER_KEYS);
    for (const key of WEATHER_KEYS) {
      expectFiniteNumber((body.weather as Record<string, unknown>)[key]);
    }

    expect(Array.isArray(body.candidates)).toBe(true);
    for (const candidate of body.candidates as Array<Record<string, unknown>>) {
      expectExactKeys(candidate, CANDIDATE_KEYS);
      expectFiniteNumber(candidate.lat);
      expectFiniteNumber(candidate.lon);
      expect(typeof candidate.region).toBe('string');
    }

    expect(findLeakedActualKeys(body)).toEqual([]);
  });

  it('GET /api/rounds/:id -> 200 RoundView (same shape, idempotent)', async () => {
    const { gameId, playerToken } = await createGame('medium');
    const start = await app.inject({
      method: 'POST',
      url: '/api/games/' + gameId + '/rounds',
      headers: { 'x-player-token': playerToken },
      payload: {},
    });
    const roundId = (start.json() as { roundId: string }).roundId;

    const res = await app.inject({
      method: 'GET',
      url: '/api/rounds/' + roundId,
      headers: { 'x-player-token': playerToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expectExactKeys(body, [
      'roundId',
      'roundNumber',
      'difficulty',
      'selectionMode',
      'weather',
      'candidates',
    ]);
    expect(findLeakedActualKeys(body)).toEqual([]);
  });

  it('POST /api/rounds/:id/guess -> 200 { distanceKm, score, actual, resultId }', async () => {
    const { gameId, playerToken } = await createGame('medium');
    const start = await app.inject({
      method: 'POST',
      url: '/api/games/' + gameId + '/rounds',
      headers: { 'x-player-token': playerToken },
      payload: {},
    });
    const roundId = (start.json() as { roundId: string }).roundId;

    const res = await app.inject({
      method: 'POST',
      url: '/api/rounds/' + roundId + '/guess',
      headers: { 'x-player-token': playerToken },
      payload: { lat: 48.8566, lon: 2.3522 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    // API-CONTRACTS.md lists exactly these four fields (no roundId).
    expectExactKeys(body, ['distanceKm', 'score', 'actual', 'resultId']);
    expectFiniteNumber(body.distanceKm);
    expect(Number.isInteger(body.score)).toBe(true);
    expect(typeof body.resultId).toBe('string');
    expectExactKeys(body.actual, LATLON_KEYS);
    expectFiniteNumber((body.actual as Record<string, unknown>).lat);
    expectFiniteNumber((body.actual as Record<string, unknown>).lon);
  });

  it('GET /api/games/:id/results -> 200 { results, totalScore }', async () => {
    const { gameId, playerToken } = await createGame('medium');
    const start = await app.inject({
      method: 'POST',
      url: '/api/games/' + gameId + '/rounds',
      headers: { 'x-player-token': playerToken },
      payload: {},
    });
    const roundId = (start.json() as { roundId: string }).roundId;
    await app.inject({
      method: 'POST',
      url: '/api/rounds/' + roundId + '/guess',
      headers: { 'x-player-token': playerToken },
      payload: { lat: 48.8566, lon: 2.3522 },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/games/' + gameId + '/results',
      headers: { 'x-player-token': playerToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expectExactKeys(body, ['results', 'totalScore']);
    expectFiniteNumber(body.totalScore);
    expect(Array.isArray(body.results)).toBe(true);
    for (const result of body.results as Array<Record<string, unknown>>) {
      expectExactKeys(result, RESULT_KEYS);
      expect(typeof result.resultId).toBe('string');
      expect(Number.isInteger(result.roundNumber)).toBe(true);
      expectFiniteNumber(result.distanceKm);
      expect(Number.isInteger(result.score)).toBe(true);
      expectExactKeys(result.actual, LATLON_KEYS);
      expectExactKeys(result.guess, LATLON_KEYS);
      expect(typeof result.createdAt).toBe('string');
      expect(Number.isNaN(Date.parse(result.createdAt as string))).toBe(false);
    }
  });

  it('GET /api/results/:id -> 200 ResultDTO', async () => {
    const { gameId, playerToken } = await createGame('medium');
    const start = await app.inject({
      method: 'POST',
      url: '/api/games/' + gameId + '/rounds',
      headers: { 'x-player-token': playerToken },
      payload: {},
    });
    const roundId = (start.json() as { roundId: string }).roundId;
    const guess = await app.inject({
      method: 'POST',
      url: '/api/rounds/' + roundId + '/guess',
      headers: { 'x-player-token': playerToken },
      payload: { lat: 48.8566, lon: 2.3522 },
    });
    const resultId = (guess.json() as { resultId: string }).resultId;

    const res = await app.inject({
      method: 'GET',
      url: '/api/results/' + resultId,
      headers: { 'x-player-token': playerToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expectExactKeys(body, RESULT_KEYS);
    expect(typeof body.resultId).toBe('string');
    expect(Number.isInteger(body.roundNumber)).toBe(true);
    expectFiniteNumber(body.distanceKm);
    expect(Number.isInteger(body.score)).toBe(true);
    expectExactKeys(body.actual, LATLON_KEYS);
    expectExactKeys(body.guess, LATLON_KEYS);
    expect(typeof body.createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(body.createdAt as string))).toBe(false);
  });

  it('every non-2xx response uses the ADR-0009 error envelope', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { mode: 'invalid', difficulty: 'easy' },
    });
    expect(invalid.statusCode).toBe(400);
    expectErrorEnvelope(invalid.json(), 'VALIDATION_ERROR');

    const missing = await app.inject({
      method: 'GET',
      url: '/api/games/nonexistent',
      headers: { 'x-player-token': 'wrong-token' },
    });
    expect(missing.statusCode).toBe(404);
    expectErrorEnvelope(missing.json(), 'NOT_FOUND');

    const { gameId, playerToken } = await createGame('medium');
    const start = await app.inject({
      method: 'POST',
      url: '/api/games/' + gameId + '/rounds',
      headers: { 'x-player-token': playerToken },
      payload: {},
    });
    const roundId = (start.json() as { roundId: string }).roundId;
    const first = await app.inject({
      method: 'POST',
      url: '/api/rounds/' + roundId + '/guess',
      headers: { 'x-player-token': playerToken },
      payload: { lat: 0, lon: 0 },
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: 'POST',
      url: '/api/rounds/' + roundId + '/guess',
      headers: { 'x-player-token': playerToken },
      payload: { lat: 1, lon: 1 },
    });
    expect(second.statusCode).toBe(409);
    expectErrorEnvelope(second.json(), 'CONFLICT');
  });
});
