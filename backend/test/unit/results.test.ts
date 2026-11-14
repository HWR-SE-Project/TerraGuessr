import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

import { ROUNDS_PER_GAME } from '../../src/config/constants.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import {
  GameNotFoundError,
  generatePlayerToken,
  hashPlayerToken,
} from '../../src/plugins/auth.js';
import { scoreForDistance } from '../../src/domain/scoring.js';
import {
  GuessConflictError,
  submitGuess,
} from '../../src/modules/rounds/guess.js';
import {
  getGameResults,
  getResult,
} from '../../src/modules/results/service.js';
import { registerResultsRoutes } from '../../src/modules/results/routes.js';
import { registerRoundsRoutes } from '../../src/modules/rounds/routes.js';

const BERLIN = { lat: 52.52, lon: 13.405 } as const;
const PARIS = { lat: 48.8566, lon: 2.3522 } as const;

/** Prisma client shape accepted by submitGuess (injected in tests). */
type PrismaLike = Parameters<typeof submitGuess>[2];

interface RoundForGuess {
  id: string;
  roundNumber: number;
  status: 'active' | 'completed';
  location: { lat: number; lon: number };
  guess: { id: string } | null;
  game: { id: string; mode: 'solo' | 'challenge' };
}

function roundForGuess(overrides: Partial<RoundForGuess> = {}): RoundForGuess {
  return {
    id: 'round-1',
    roundNumber: 1,
    status: 'active',
    location: { lat: BERLIN.lat, lon: BERLIN.lon },
    guess: null,
    game: { id: 'game-1', mode: 'solo' },
    ...overrides,
  };
}

function buildGuessDb(round: RoundForGuess = roundForGuess()) {
  const guessCreate = vi.fn().mockResolvedValue({ id: 'guess-1' });
  const resultCreate = vi.fn(
    async (args: { data: Record<string, unknown> }) => ({
      id: 'result-1',
      ...args.data,
    }),
  );
  const roundUpdate = vi.fn().mockResolvedValue({ id: 'round-1' });
  const gameUpdate = vi.fn().mockResolvedValue({ id: 'game-1' });

  const tx = {
    guess: { create: guessCreate },
    result: { create: resultCreate },
    round: { update: roundUpdate },
    game: { update: gameUpdate },
  };

  const roundFindUnique = vi.fn().mockResolvedValue(round);
  const transaction = vi.fn(
    async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx),
  );

  const db = {
    round: { findUnique: roundFindUnique },
    $transaction: transaction,
  } as unknown as PrismaLike;

  return {
    db,
    tx,
    roundFindUnique,
    transaction,
    guessCreate,
    resultCreate,
    roundUpdate,
    gameUpdate,
  };
}

describe('submitGuess', () => {
  it('computes Berlin→Paris distance (~877 km) and score, and reveals the actual location (R09/R10/R11)', async () => {
    const { db } = buildGuessDb();

    const result = await submitGuess('round-1', PARIS, db);

    expect(result.distanceKm).toBeGreaterThanOrEqual(876);
    expect(result.distanceKm).toBeLessThanOrEqual(878);
    expect(result.distanceKm).toBeCloseTo(877.4645, 3);
    expect(result.score).toBe(scoreForDistance(result.distanceKm));
    expect(result.score).toBe(3224);
    expect(result.actual).toEqual({ lat: BERLIN.lat, lon: BERLIN.lon });
    expect(result.resultId).toBe('result-1');
  });

  it('persists Guess + Result and completes the round in one transaction', async () => {
    const {
      db,
      transaction,
      guessCreate,
      resultCreate,
      roundUpdate,
      gameUpdate,
    } = buildGuessDb();

    const result = await submitGuess('round-1', PARIS, db);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(guessCreate).toHaveBeenCalledWith({
      data: { roundId: 'round-1', lat: PARIS.lat, lon: PARIS.lon },
    });
    expect(resultCreate).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        actualLat: BERLIN.lat,
        actualLon: BERLIN.lon,
        guessLat: PARIS.lat,
        guessLon: PARIS.lon,
        distanceKm: result.distanceKm,
        score: result.score,
      },
    });
    expect(roundUpdate).toHaveBeenCalledWith({
      where: { id: 'round-1' },
      data: expect.objectContaining({
        status: 'completed',
        completedAt: expect.any(Date),
      }),
    });
    expect(gameUpdate).not.toHaveBeenCalled();
  });

  it('rejects a second guess with 409 (R08)', async () => {
    const { db } = buildGuessDb(
      roundForGuess({ status: 'completed', guess: { id: 'guess-1' } }),
    );

    const promise = submitGuess('round-1', PARIS, db);

    await expect(promise).rejects.toBeInstanceOf(GuessConflictError);
    await expect(promise).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects a guess on a non-active round with 409', async () => {
    const { db } = buildGuessDb(roundForGuess({ status: 'completed' }));

    await expect(submitGuess('round-1', PARIS, db)).rejects.toBeInstanceOf(
      GuessConflictError,
    );
  });

  it('marks the game completed when the final solo round is guessed', async () => {
    const { db, gameUpdate } = buildGuessDb(
      roundForGuess({
        roundNumber: ROUNDS_PER_GAME,
        game: { id: 'game-1', mode: 'solo' },
      }),
    );

    await submitGuess('round-1', PARIS, db);

    expect(gameUpdate).toHaveBeenCalledWith({
      where: { id: 'game-1' },
      data: { status: 'completed' },
    });
  });

  it('does not complete the game for a non-final round', async () => {
    const { db, gameUpdate } = buildGuessDb(roundForGuess({ roundNumber: 1 }));

    await submitGuess('round-1', PARIS, db);

    expect(gameUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the round does not exist', async () => {
    const { db, roundFindUnique } = buildGuessDb();
    roundFindUnique.mockResolvedValue(null);

    await expect(submitGuess('missing', PARIS, db)).rejects.toBeInstanceOf(
      GameNotFoundError,
    );
  });
});

describe('results service', () => {
  it('getGameResults returns full ResultDTOs + totalScore, ordered', async () => {
    const game = {
      id: 'game-1',
      rounds: [
        {
          id: 'r1',
          roundNumber: 1,
          result: {
            id: 'res-1',
            roundId: 'r1',
            actualLat: 52.52,
            actualLon: 13.405,
            guessLat: 48.8566,
            guessLon: 2.3522,
            distanceKm: 877.4645,
            score: 3224,
            createdAt: new Date(),
          },
        },
        {
          id: 'r2',
          roundNumber: 2,
          result: {
            id: 'res-2',
            roundId: 'r2',
            actualLat: 1,
            actualLon: 2,
            guessLat: 3,
            guessLon: 4,
            distanceKm: 100,
            score: 4500,
            createdAt: new Date(),
          },
        },
      ],
    };

    const db = {
      game: { findUnique: vi.fn().mockResolvedValue(game) },
    } as unknown as PrismaLike;

    const list = await getGameResults('game-1', db);

    expect(list.totalScore).toBe(7724);
    expect(list.results).toHaveLength(2);
    expect(list.results[0]).toEqual({
      resultId: 'res-1',
      roundNumber: 1,
      distanceKm: 877.4645,
      score: 3224,
      actual: { lat: 52.52, lon: 13.405 },
      guess: { lat: 48.8566, lon: 2.3522 },
      createdAt: expect.any(String),
    });
  });

  it('getGameResults returns 404 when the game does not exist', async () => {
    const db = {
      game: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaLike;

    await expect(getGameResults('missing', db)).rejects.toBeInstanceOf(
      GameNotFoundError,
    );
  });

  it('getResult returns a full ResultDTO', async () => {
    const db = {
      result: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'res-1',
          round: { roundNumber: 1 },
          distanceKm: 877.4645,
          score: 3224,
          actualLat: 52.52,
          actualLon: 13.405,
          guessLat: 48.8566,
          guessLon: 2.3522,
          createdAt: new Date('2026-11-14T12:00:00Z'),
        }),
      },
    } as unknown as PrismaLike;

    const item = await getResult('res-1', db);

    expect(item).toEqual({
      resultId: 'res-1',
      roundNumber: 1,
      distanceKm: 877.4645,
      score: 3224,
      actual: { lat: 52.52, lon: 13.405 },
      guess: { lat: 48.8566, lon: 2.3522 },
      createdAt: '2026-11-14T12:00:00.000Z',
    });
  });

  it('getResult returns 404 when the result does not exist', async () => {
    const db = {
      result: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaLike;

    await expect(getResult('missing', db)).rejects.toBeInstanceOf(
      GameNotFoundError,
    );
  });
});

describe('results routes', () => {
  it('GET /api/games/:id/results returns the list for the owning token', async () => {
    const token = generatePlayerToken();
    const game = {
      id: 'game-1',
      playerTokenHash: hashPlayerToken(token),
      rounds: [
        {
          id: 'r1',
          roundNumber: 1,
          result: {
            id: 'res-1',
            roundId: 'r1',
            actualLat: 52.52,
            actualLon: 13.405,
            guessLat: 48.8566,
            guessLon: 2.3522,
            distanceKm: 877.4645,
            score: 3224,
            createdAt: new Date(),
          },
        },
      ],
    };
    const db = {
      game: { findUnique: vi.fn().mockResolvedValue(game) },
    } as unknown as PrismaLike;

    const app = Fastify();
    registerErrorHandler(app);
    registerResultsRoutes(app, db);

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/games/game-1/results',
        headers: { 'x-player-token': token },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        results: [
          {
            resultId: 'res-1',
            roundNumber: 1,
            distanceKm: 877.4645,
            score: 3224,
            actual: { lat: 52.52, lon: 13.405 },
            guess: { lat: 48.8566, lon: 2.3522 },
            createdAt: expect.any(String),
          },
        ],
        totalScore: 3224,
      });
    } finally {
      await app.close();
    }
  });

  it('GET /api/results/:id returns 404 NOT_FOUND without a token', async () => {
    const db = {
      result: { findUnique: vi.fn() },
    } as unknown as PrismaLike;

    const app = Fastify();
    registerErrorHandler(app);
    registerResultsRoutes(app, db);

    try {
      const res = await app.inject({ method: 'GET', url: '/api/results/res-1' });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Game not found' },
      });
    } finally {
      await app.close();
    }
  });

  it('POST /api/rounds/:id/guess returns 409 CONFLICT envelope on a double guess', async () => {
    const token = generatePlayerToken();
    const round = roundForGuess({
      status: 'completed',
      guess: { id: 'guess-1' },
    });

    const roundFindUnique = vi.fn(async (args: { select?: unknown }) => {
      if (args.select) {
        return { game: { playerTokenHash: hashPlayerToken(token) } };
      }
      return round;
    });
    const db = {
      round: { findUnique: roundFindUnique },
      $transaction: vi.fn(),
    } as unknown as PrismaLike;

    const app = Fastify();
    registerErrorHandler(app);
    registerRoundsRoutes(app, db);

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/rounds/round-1/guess',
        headers: { 'x-player-token': token },
        payload: { lat: PARIS.lat, lon: PARIS.lon },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        error: {
          code: 'CONFLICT',
          message: 'Guess already submitted or round is not active',
        },
      });
    } finally {
      await app.close();
    }
  });
});
