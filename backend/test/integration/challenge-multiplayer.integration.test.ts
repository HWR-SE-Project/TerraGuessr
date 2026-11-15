import './helpers/env.js'; // first: sets DATABASE_URL before any db/prisma import
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import {
  DEFAULT_WEATHER,
  StubWeatherClient,
  buildTestApp,
  setupDatabase,
  teardownDatabase,
} from './helpers/database.js';

/**
 * P0-3 regression: two independent players (no shared token) must be able to
 * join the same async challenge, submit separate guesses/results, and see a
 * correct leaderboard — without either player's answer overwriting the
 * other's.
 */
describe('async challenge multiplayer (integration, R16/P0-3)', () => {
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

  async function createSoloGame(difficulty: 'easy' | 'medium' | 'hard') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { mode: 'solo', difficulty },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { gameId: string; playerToken: string };
  }

  async function startRound(gameId: string, playerToken: string) {
    return app.inject({
      method: 'POST',
      url: '/api/games/' + gameId + '/rounds',
      headers: { 'x-player-token': playerToken },
      payload: {},
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

  it('two independent players join the same challenge, guess separately, and both land on the leaderboard', async () => {
    // Player A plays a normal solo round, then shares it as a challenge.
    const playerA = await createSoloGame('medium');
    const roundA = await startRound(playerA.gameId, playerA.playerToken);
    expect(roundA.statusCode).toBe(201);
    const roundAId = roundA.json().roundId as string;

    const guessA = await submitGuess(roundAId, playerA.playerToken, { lat: 10, lon: 10 });
    expect(guessA.statusCode).toBe(200);
    const resultA = guessA.json();

    const createChallenge = await app.inject({
      method: 'POST',
      url: '/api/challenges',
      headers: { 'x-player-token': playerA.playerToken },
      payload: { roundId: roundAId },
    });
    expect(createChallenge.statusCode).toBe(201);
    const { challengeId } = createChallenge.json();

    // Player A enters their own result.
    const entryA = await app.inject({
      method: 'POST',
      url: '/api/challenges/' + challengeId + '/entries',
      headers: { 'x-player-token': playerA.playerToken },
      payload: { resultId: resultA.resultId, displayName: 'Alice' },
    });
    expect(entryA.statusCode).toBe(201);

    // Player B — a completely independent browser/token — joins the same
    // challenge without ever seeing player A's token.
    const joinB = await app.inject({
      method: 'POST',
      url: '/api/challenges/' + challengeId + '/join',
      payload: {},
    });
    expect(joinB.statusCode).toBe(201);
    const joined = joinB.json() as {
      gameId: string;
      playerToken: string;
      round: { roundId: string; weather: Record<string, number> };
    };
    expect(joined.playerToken).not.toBe(playerA.playerToken);
    // Same location/weather as the original challenge round (fairness).
    expect(joined.round.weather).toEqual(DEFAULT_WEATHER);

    // Player B cannot be rejected as "not for this challenge round" — their
    // own round is a different roundId by construction.
    expect(joined.round.roundId).not.toBe(roundAId);

    const guessB = await submitGuess(joined.round.roundId, joined.playerToken, {
      lat: 11,
      lon: 11,
    });
    expect(guessB.statusCode).toBe(200);
    const resultB = guessB.json();
    // Distinct Result row — player B's answer never overwrote player A's.
    expect(resultB.resultId).not.toBe(resultA.resultId);

    const entryB = await app.inject({
      method: 'POST',
      url: '/api/challenges/' + challengeId + '/entries',
      headers: { 'x-player-token': joined.playerToken },
      payload: { resultId: resultB.resultId, displayName: 'Bob' },
    });
    expect(entryB.statusCode).toBe(201);

    // Both independent players show up on the public leaderboard.
    const leaderboard = await app.inject({
      method: 'GET',
      url: '/api/challenges/' + challengeId + '/leaderboard',
    });
    expect(leaderboard.statusCode).toBe(200);
    const board = leaderboard.json() as { entries: Array<{ displayName: string | null }> };
    const names = board.entries.map((entry) => entry.displayName).sort();
    expect(names).toEqual(['Alice', 'Bob']);

    // Player A's own guess/result row is untouched by player B joining.
    const roundACheck = await prisma.round.findUnique({
      where: { id: roundAId },
      include: { result: true },
    });
    expect(roundACheck?.result?.id).toBe(resultA.resultId);
  });

  it('a player cannot submit a second entry to the same challenge under their own token', async () => {
    const owner = await createSoloGame('hard');
    const ownerRound = await startRound(owner.gameId, owner.playerToken);
    const ownerRoundId = ownerRound.json().roundId as string;
    const ownerGuess = await submitGuess(ownerRoundId, owner.playerToken, { lat: 0, lon: 0 });
    const ownerResult = ownerGuess.json();

    const created = await app.inject({
      method: 'POST',
      url: '/api/challenges',
      headers: { 'x-player-token': owner.playerToken },
      payload: { roundId: ownerRoundId },
    });
    const { challengeId } = created.json();

    const join = await app.inject({
      method: 'POST',
      url: '/api/challenges/' + challengeId + '/join',
      payload: {},
    });
    const joined = join.json() as {
      playerToken: string;
      round: { roundId: string };
    };
    const guess1 = await submitGuess(joined.round.roundId, joined.playerToken, {
      lat: 1,
      lon: 1,
    });
    const result1 = guess1.json();

    const firstEntry = await app.inject({
      method: 'POST',
      url: '/api/challenges/' + challengeId + '/entries',
      headers: { 'x-player-token': joined.playerToken },
      payload: { resultId: result1.resultId },
    });
    expect(firstEntry.statusCode).toBe(201);

    // The same joined player cannot ALSO submit the owner's result (not
    // their own) ...
    const stolenEntry = await app.inject({
      method: 'POST',
      url: '/api/challenges/' + challengeId + '/entries',
      headers: { 'x-player-token': joined.playerToken },
      payload: { resultId: ownerResult.resultId },
    });
    expect(stolenEntry.statusCode).toBe(404); // not their result (ownership, ADR-0011)

    // ... nor can the owner's own second attempt at the entries endpoint
    // double-enter (one entry per player per challenge).
    const secondOwnerEntry = await app.inject({
      method: 'POST',
      url: '/api/challenges/' + challengeId + '/entries',
      headers: { 'x-player-token': owner.playerToken },
      payload: { resultId: ownerResult.resultId },
    });
    expect(secondOwnerEntry.statusCode).toBe(201); // first entry for the owner, allowed

    const duplicateOwnerEntry = await app.inject({
      method: 'POST',
      url: '/api/challenges/' + challengeId + '/entries',
      headers: { 'x-player-token': owner.playerToken },
      payload: { resultId: ownerResult.resultId },
    });
    expect(duplicateOwnerEntry.statusCode).toBe(409);
  });
});
