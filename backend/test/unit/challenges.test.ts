import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import {
  GameNotFoundError,
  generatePlayerToken,
  hashPlayerToken,
} from '../../src/plugins/auth.js';
import {
  ChallengeConflictError,
  addEntry,
  createChallenge,
  getLeaderboard,
} from '../../src/modules/challenges/service.js';
import { registerChallengesRoutes } from '../../src/modules/challenges/routes.js';

/** Prisma client shape accepted by the challenges service (injected in tests). */
type PrismaLike = Parameters<typeof createChallenge>[1];

describe('challenges service', () => {
  describe('createChallenge', () => {
    it('returns a challenge id and a relative shareUrl (no real domain)', async () => {
      const db = {
        round: { findUnique: vi.fn().mockResolvedValue({ id: 'round-1' }) },
        challenge: { create: vi.fn().mockResolvedValue({ id: 'challenge-1' }) },
      } as unknown as PrismaLike;

      const result = await createChallenge('round-1', db);

      expect(result.challengeId).toBe('challenge-1');
      expect(result.shareUrl).toBe('/challenge/challenge-1');
      expect(result.shareUrl).not.toMatch(/https?:\/\//);
    });

    it('throws 404 when the round does not exist', async () => {
      const db = {
        round: { findUnique: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaLike;

      await expect(createChallenge('missing', db)).rejects.toBeInstanceOf(
        GameNotFoundError,
      );
    });
  });

  describe('addEntry', () => {
    it('rejects a result for a different round with 409', async () => {
      const db = {
        challenge: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'challenge-1', roundId: 'round-A' }),
        },
        result: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: 'result-1',
              roundId: 'round-B',
              score: 1000,
              distanceKm: 10,
            }),
        },
      } as unknown as PrismaLike;

      const promise = addEntry('challenge-1', { resultId: 'result-1' }, db);

      await expect(promise).rejects.toBeInstanceOf(ChallengeConflictError);
      await expect(promise).rejects.toMatchObject({ statusCode: 409 });
    });

    it('rejects a duplicate entry with 409', async () => {
      const db = {
        challenge: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'challenge-1', roundId: 'round-1' }),
        },
        result: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: 'result-1',
              roundId: 'round-1',
              score: 1000,
              distanceKm: 10,
            }),
        },
        challengeEntry: {
          findFirst: vi.fn().mockResolvedValue({ id: 'entry-existing' }),
        },
      } as unknown as PrismaLike;

      const promise = addEntry('challenge-1', { resultId: 'result-1' }, db);

      await expect(promise).rejects.toBeInstanceOf(ChallengeConflictError);
      await expect(promise).rejects.toMatchObject({ statusCode: 409 });
    });

    it('creates an entry and computes its competition rank', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'e3' });
      const db = {
        challenge: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'challenge-1', roundId: 'round-1' }),
        },
        result: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: 'result-3',
              roundId: 'round-1',
              score: 4000,
              distanceKm: 8,
            }),
        },
        challengeEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([
            { id: 'e1', result: { score: 4500, distanceKm: 5 } },
            { id: 'e2', result: { score: 3000, distanceKm: 20 } },
          ]),
          create,
        },
      } as unknown as PrismaLike;

      const result = await addEntry(
        'challenge-1',
        { resultId: 'result-3', displayName: 'Carol' },
        db,
      );

      expect(result.entryId).toBe('e3');
      expect(result.rank).toBe(2); // 4500 is better, 3000 is worse
      expect(create).toHaveBeenCalledWith({
        data: {
          challengeId: 'challenge-1',
          resultId: 'result-3',
          displayName: 'Carol',
        },
      });
    });

    it('throws 404 when the challenge does not exist', async () => {
      const db = {
        challenge: { findUnique: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaLike;

      await expect(
        addEntry('missing', { resultId: 'result-1' }, db),
      ).rejects.toBeInstanceOf(GameNotFoundError);
    });

    it('throws 404 when the result does not exist', async () => {
      const db = {
        challenge: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'challenge-1', roundId: 'round-1' }),
        },
        result: { findUnique: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaLike;

      await expect(
        addEntry('challenge-1', { resultId: 'missing' }, db),
      ).rejects.toBeInstanceOf(GameNotFoundError);
    });
  });

  describe('getLeaderboard', () => {
    it('ranks entries by score desc then distance asc', async () => {
      const challenge = {
        id: 'challenge-1',
        entries: [
          { id: 'e1', displayName: 'Alice', result: { score: 3000, distanceKm: 50 } },
          { id: 'e2', displayName: null, result: { score: 4500, distanceKm: 10 } },
          { id: 'e3', displayName: 'Carol', result: { score: 3000, distanceKm: 5 } },
        ],
      };
      const db = {
        challenge: { findUnique: vi.fn().mockResolvedValue(challenge) },
      } as unknown as PrismaLike;

      const board = await getLeaderboard('challenge-1', db);

      expect(board.challengeId).toBe('challenge-1');
      expect(board.entries.map((entry) => entry.displayName)).toEqual([
        null,
        'Carol',
        'Alice',
      ]);
      expect(board.entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
      expect(board.entries.map((entry) => entry.score)).toEqual([
        4500, 3000, 3000,
      ]);
      expect(board.entries.map((entry) => entry.distanceKm)).toEqual([
        10, 5, 50,
      ]);
    });

    it('returns only entries attached to the challenge (its fixed round)', async () => {
      const challenge = {
        id: 'challenge-1',
        entries: [
          { id: 'e1', displayName: 'Alice', result: { score: 1000, distanceKm: 10 } },
          { id: 'e2', displayName: 'Bob', result: { score: 2000, distanceKm: 20 } },
        ],
      };
      const db = {
        challenge: { findUnique: vi.fn().mockResolvedValue(challenge) },
      } as unknown as PrismaLike;

      const board = await getLeaderboard('challenge-1', db);

      expect(board.entries).toHaveLength(2);
      expect(board.entries.map((entry) => entry.score)).toEqual([2000, 1000]);
    });

    it('returns displayName null as null (client renders "Anonymous")', async () => {
      const challenge = {
        id: 'challenge-1',
        entries: [
          { id: 'e1', displayName: null, result: { score: 5000, distanceKm: 0 } },
        ],
      };
      const db = {
        challenge: { findUnique: vi.fn().mockResolvedValue(challenge) },
      } as unknown as PrismaLike;

      const board = await getLeaderboard('challenge-1', db);

      expect(board.entries[0]?.displayName).toBeNull();
    });

    it('throws 404 when the challenge does not exist', async () => {
      const db = {
        challenge: { findUnique: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaLike;

      await expect(getLeaderboard('missing', db)).rejects.toBeInstanceOf(
        GameNotFoundError,
      );
    });
  });
});

describe('challenges routes', () => {
  it('POST /api/challenges returns 404 without a token', async () => {
    const db = {
      round: { findUnique: vi.fn() },
      challenge: { create: vi.fn() },
    } as unknown as PrismaLike;

    const app = Fastify();
    registerErrorHandler(app);
    registerChallengesRoutes(app, db);

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/challenges',
        payload: { roundId: 'round-1' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Game not found' },
      });
    } finally {
      await app.close();
    }
  });

  it('POST /api/challenges/:id/entries returns 404 without a token', async () => {
    const db = {
      result: { findUnique: vi.fn() },
    } as unknown as PrismaLike;

    const app = Fastify();
    registerErrorHandler(app);
    registerChallengesRoutes(app, db);

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/challenges/challenge-1/entries',
        payload: { resultId: 'result-1' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Game not found' },
      });
    } finally {
      await app.close();
    }
  });

  it('POST /api/challenges/:id/entries rejects a displayName over 40 chars with 400', async () => {
    const db = {} as unknown as PrismaLike;

    const app = Fastify();
    registerErrorHandler(app);
    registerChallengesRoutes(app, db);

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/challenges/challenge-1/entries',
        payload: { resultId: 'result-1', displayName: 'x'.repeat(41) },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await app.close();
    }
  });

  it('GET /api/challenges/:id/leaderboard is public (no auth)', async () => {
    const challenge = {
      id: 'challenge-1',
      entries: [
        { id: 'e1', displayName: 'Alice', result: { score: 3000, distanceKm: 50 } },
      ],
    };
    const db = {
      challenge: { findUnique: vi.fn().mockResolvedValue(challenge) },
    } as unknown as PrismaLike;

    const app = Fastify();
    registerErrorHandler(app);
    registerChallengesRoutes(app, db);

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/challenges/challenge-1/leaderboard',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        challengeId: 'challenge-1',
        entries: [
          { rank: 1, displayName: 'Alice', score: 3000, distanceKm: 50 },
        ],
      });
    } finally {
      await app.close();
    }
  });

  it('POST /api/challenges returns 201 for the round owner', async () => {
    const token = generatePlayerToken();
    const db = {
      round: {
        findUnique: vi.fn().mockResolvedValue({
          game: { playerTokenHash: hashPlayerToken(token) },
        }),
      },
      challenge: { create: vi.fn().mockResolvedValue({ id: 'challenge-1' }) },
    } as unknown as PrismaLike;

    const app = Fastify();
    registerErrorHandler(app);
    registerChallengesRoutes(app, db);

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/challenges',
        headers: { 'x-player-token': token },
        payload: { roundId: 'round-1' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        challengeId: 'challenge-1',
        shareUrl: '/challenge/challenge-1',
      });
    } finally {
      await app.close();
    }
  });
});
