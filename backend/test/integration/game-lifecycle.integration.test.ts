import './helpers/env.js'; // first: sets DATABASE_URL before any db/prisma import
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { ROUNDS_PER_GAME } from '../../src/config/constants.js';
import {
  DEFAULT_WEATHER,
  StubWeatherClient,
  buildTestApp,
  findLeakedActualKeys,
  setupDatabase,
  teardownDatabase,
} from './helpers/database.js';

describe('game + round lifecycle (integration)', () => {
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

  async function startRound(
    gameId: string,
    playerToken: string,
    selectionMode?: 'map' | 'list',
  ) {
    return app.inject({
      method: 'POST',
      url: '/api/games/' + gameId + '/rounds',
      headers: { 'x-player-token': playerToken },
      payload: selectionMode ? { selectionMode } : {},
    });
  }

  async function submitGuess(
    roundId: string,
    playerToken: string,
    guess: { lat: number; lon: number },
  ) {
    return app.inject({
      method: 'POST',
      url: '/api/rounds/' + roundId + '/guess',
      headers: { 'x-player-token': playerToken },
      payload: guess,
    });
  }

  it('full lifecycle: create -> start round (weather + R04) -> guess (reveal) -> persisted Guess+Result', async () => {
    const { gameId, playerToken } = await createGame('medium');

    const start = await startRound(gameId, playerToken);
    expect(start.statusCode).toBe(201);
    const round = start.json();
    expect(round.selectionMode).toBe('list');
    expect(round.weather).toEqual(DEFAULT_WEATHER);
    expect(Array.isArray(round.candidates)).toBe(true);
    expect(round.candidates.length).toBeGreaterThan(0);
    expect(findLeakedActualKeys(round)).toEqual([]);

    const guess = await submitGuess(round.roundId, playerToken, { lat: 48.8566, lon: 2.3522 });
    expect(guess.statusCode).toBe(200);
    const result = guess.json();
    expect(Number.isFinite(result.distanceKm)).toBe(true);
    expect(Number.isInteger(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(5000);
    expect(result.actual).toEqual({ lat: expect.any(Number), lon: expect.any(Number) });
    expect(typeof result.resultId).toBe('string');

    // Persistence: Guess + Result rows exist and the round is completed.
    const dbRound = await prisma.round.findUnique({
      where: { id: round.roundId },
      include: { guess: true, result: true },
    });
    expect(dbRound?.status).toBe('completed');
    expect(dbRound?.guess).not.toBeNull();
    expect(dbRound?.result).not.toBeNull();
    expect(dbRound?.result?.roundId).toBe(round.roundId);
  });

  it('409 on a second guess for the same round (R08)', async () => {
    const { gameId, playerToken } = await createGame('medium');
    const start = await startRound(gameId, playerToken);
    const roundId = start.json().roundId;

    const first = await submitGuess(roundId, playerToken, { lat: 0, lon: 0 });
    expect(first.statusCode).toBe(200);
    const second = await submitGuess(roundId, playerToken, { lat: 1, lon: 1 });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('409 on POST rounds while a round is active (state machine)', async () => {
    const { gameId, playerToken } = await createGame('medium');
    const first = await startRound(gameId, playerToken);
    expect(first.statusCode).toBe(201);
    const second = await startRound(gameId, playerToken);
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('404 for POST rounds with a wrong token (ownership never reveals existence)', async () => {
    const { gameId } = await createGame('medium');
    const res = await startRound(gameId, 'wrong-token');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('404 for GET round with a wrong token', async () => {
    const { gameId, playerToken } = await createGame('medium');
    const start = await startRound(gameId, playerToken);
    const roundId = start.json().roundId;
    const res = await app.inject({
      method: 'GET',
      url: '/api/rounds/' + roundId,
      headers: { 'x-player-token': 'wrong-token' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('R04: raw round-start + re-fetch JSON carries no actual coordinates at any depth', async () => {
    const { gameId, playerToken } = await createGame('medium');
    const start = await startRound(gameId, playerToken);
    expect(start.statusCode).toBe(201);
    expect(findLeakedActualKeys(start.json())).toEqual([]);

    const roundId = start.json().roundId;
    const refetch = await app.inject({
      method: 'GET',
      url: '/api/rounds/' + roundId,
      headers: { 'x-player-token': playerToken },
    });
    expect(refetch.statusCode).toBe(200);
    expect(findLeakedActualKeys(refetch.json())).toEqual([]);
  });

  it('completing the final solo round flips the game to completed', async () => {
    const { gameId, playerToken } = await createGame('hard');
    for (let roundNumber = 1; roundNumber <= ROUNDS_PER_GAME; roundNumber += 1) {
      const start = await startRound(gameId, playerToken);
      expect(start.statusCode).toBe(201);
      const guess = await submitGuess(start.json().roundId, playerToken, { lat: 0, lon: 0 });
      expect(guess.statusCode).toBe(200);
    }

    const summaryRes = await app.inject({
      method: 'GET',
      url: '/api/games/' + gameId,
      headers: { 'x-player-token': playerToken },
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json();
    expect(summary.status).toBe('completed');
    expect(summary.roundsPlayed).toBe(ROUNDS_PER_GAME);
    expect(summary.currentRound).toBeNull();

    // A completed game rejects any further round with 409.
    const extra = await startRound(gameId, playerToken);
    expect(extra.statusCode).toBe(409);
  });
});
