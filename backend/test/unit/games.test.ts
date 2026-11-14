import { beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { ROUNDS_PER_GAME } from '../../src/config/constants.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import {
  GameNotFoundError,
  generatePlayerToken,
  hashPlayerToken,
} from '../../src/plugins/auth.js';
import { createGame, getGameSummary } from '../../src/modules/games/service.js';
import { registerGamesRoutes } from '../../src/modules/games/routes.js';

/** Prisma client shape accepted by the games service (injected in tests). */
type PrismaLike = Parameters<typeof createGame>[2];

function buildGamesApp(db: PrismaLike): FastifyInstance {
  const app = Fastify();
  registerErrorHandler(app);
  registerGamesRoutes(app, db);
  return app;
}

describe('games module', () => {
  beforeAll(() => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/terraguessr_test';
  });

  describe('player token helpers', () => {
    it('generates a distinct 256-bit base64url token', () => {
      const token = generatePlayerToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(generatePlayerToken()).not.toBe(token);
    });

    it('hashes deterministically with SHA-256 (hex)', () => {
      const raw = 'some-player-token';
      expect(hashPlayerToken(raw)).toMatch(/^[0-9a-f]{64}$/);
      expect(hashPlayerToken(raw)).toBe(hashPlayerToken(raw));
      expect(hashPlayerToken('other')).not.toBe(hashPlayerToken(raw));
    });
  });

  describe('createGame', () => {
    it('returns the raw token once and stores only its hash', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'game1' });
      const db = { game: { create } } as unknown as PrismaLike;

      const result = await createGame('solo', 'easy', db);

      expect(result.gameId).toBe('game1');
      expect(result.playerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const call = create.mock.calls[0] as unknown as [
        { data: { mode: string; difficulty: string; playerTokenHash: string } },
      ];
      const { data } = call[0];
      expect(data.mode).toBe('solo');
      expect(data.difficulty).toBe('easy');
      expect(data.playerTokenHash).toBe(hashPlayerToken(result.playerToken));
      expect(data.playerTokenHash).not.toBe(result.playerToken);
    });
  });

  describe('getGameSummary', () => {
    it('returns roundsPlayed, roundsTotal and the active current round', async () => {
      const game = {
        id: 'game1',
        mode: 'solo',
        difficulty: 'medium',
        status: 'active',
        rounds: [
          { id: 'r1', roundNumber: 1, status: 'completed' },
          { id: 'r2', roundNumber: 2, status: 'completed' },
          { id: 'r3', roundNumber: 3, status: 'active' },
        ],
      };
      const db = {
        game: { findUnique: vi.fn().mockResolvedValue(game) },
      } as unknown as PrismaLike;

      const summary = await getGameSummary('game1', db);

      expect(summary).toEqual({
        gameId: 'game1',
        mode: 'solo',
        difficulty: 'medium',
        status: 'active',
        roundsPlayed: 2,
        roundsTotal: ROUNDS_PER_GAME,
        currentRound: { roundId: 'r3', roundNumber: 3, status: 'active' },
      });
    });

    it('returns currentRound null when there is no active round', async () => {
      const game = {
        id: 'game1',
        mode: 'solo',
        difficulty: 'easy',
        status: 'active',
        rounds: [],
      };
      const db = {
        game: { findUnique: vi.fn().mockResolvedValue(game) },
      } as unknown as PrismaLike;

      const summary = await getGameSummary('game1', db);

      expect(summary.roundsPlayed).toBe(0);
      expect(summary.roundsTotal).toBe(ROUNDS_PER_GAME);
      expect(summary.currentRound).toBeNull();
    });

    it('throws GameNotFoundError when the game does not exist', async () => {
      const db = {
        game: { findUnique: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaLike;

      await expect(getGameSummary('missing', db)).rejects.toBeInstanceOf(
        GameNotFoundError,
      );
    });
  });

  describe('games routes', () => {
    it('POST /api/games creates a game (201) and returns the token once', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'game1' });
      const db = {
        game: { create, findUnique: vi.fn() },
      } as unknown as PrismaLike;
      const app = buildGamesApp(db);

      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/games',
          payload: { mode: 'solo', difficulty: 'easy' },
        });

        expect(res.statusCode).toBe(201);
        const body = res.json() as { gameId: string; playerToken: string };
        expect(body.gameId).toBe('game1');
        expect(body.playerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

        const call = create.mock.calls[0] as unknown as [
          { data: { mode: string; difficulty: string; playerTokenHash: string } },
        ];
        expect(call[0].data.playerTokenHash).toBe(hashPlayerToken(body.playerToken));
        expect(call[0].data.playerTokenHash).not.toBe(body.playerToken);
      } finally {
        await app.close();
      }
    });

    it('POST /api/games rejects an invalid body with 400 VALIDATION_ERROR', async () => {
      const create = vi.fn();
      const db = {
        game: { create, findUnique: vi.fn() },
      } as unknown as PrismaLike;
      const app = buildGamesApp(db);

      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/games',
          payload: { mode: 'invalid', difficulty: 'easy' },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
        expect(create).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });

    it('GET /api/games/:id returns 404 NOT_FOUND without a token', async () => {
      const findUnique = vi.fn().mockResolvedValue(null);
      const db = {
        game: { create: vi.fn(), findUnique },
      } as unknown as PrismaLike;
      const app = buildGamesApp(db);

      try {
        const res = await app.inject({ method: 'GET', url: '/api/games/game1' });

        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({
          error: { code: 'NOT_FOUND', message: 'Game not found' },
        });
        expect(findUnique).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });

    it('GET /api/games/:id returns 404 NOT_FOUND with a wrong token', async () => {
      const correctToken = generatePlayerToken();
      const game = {
        id: 'game1',
        mode: 'solo',
        difficulty: 'easy',
        status: 'active',
        playerTokenHash: hashPlayerToken(correctToken),
        rounds: [],
      };
      const findUnique = vi.fn().mockResolvedValue(game);
      const db = {
        game: { create: vi.fn(), findUnique },
      } as unknown as PrismaLike;
      const app = buildGamesApp(db);

      try {
        const res = await app.inject({
          method: 'GET',
          url: '/api/games/game1',
          headers: { 'x-player-token': 'wrong-token' },
        });

        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({
          error: { code: 'NOT_FOUND', message: 'Game not found' },
        });
        expect(findUnique).toHaveBeenCalledWith({ where: { id: 'game1' } });
      } finally {
        await app.close();
      }
    });

    it('GET /api/games/:id returns the summary with a valid token', async () => {
      const correctToken = generatePlayerToken();
      const game = {
        id: 'game1',
        mode: 'solo',
        difficulty: 'medium',
        status: 'active',
        playerTokenHash: hashPlayerToken(correctToken),
        rounds: [
          { id: 'r1', roundNumber: 1, status: 'completed' },
          { id: 'r2', roundNumber: 2, status: 'active' },
        ],
      };
      const findUnique = vi.fn().mockResolvedValue(game);
      const db = {
        game: { create: vi.fn(), findUnique },
      } as unknown as PrismaLike;
      const app = buildGamesApp(db);

      try {
        const res = await app.inject({
          method: 'GET',
          url: '/api/games/game1',
          headers: { 'x-player-token': correctToken },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
          gameId: 'game1',
          mode: 'solo',
          difficulty: 'medium',
          status: 'active',
          roundsPlayed: 1,
          roundsTotal: ROUNDS_PER_GAME,
          currentRound: { roundId: 'r2', roundNumber: 2, status: 'active' },
        });
      } finally {
        await app.close();
      }
    });
  });
});
