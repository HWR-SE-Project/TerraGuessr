import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { hashPlayerToken } from '../../src/plugins/auth.js';
import { createSingleplayerService } from '../../src/modules/singleplayer/service.js';

describe('singleplayer hot-path DB queries (C-2, M-3)', () => {
  it('creates a singleplayer game without triggering global settlement or deletion of expired games', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'game-new-1' });
    const deleteMany = vi.fn();
    const findManyRounds = vi.fn();
    const transaction = vi.fn();

    const db = {
      streetGame: { create, deleteMany },
      streetRound: { findMany: findManyRounds },
      $transaction: transaction,
    } as unknown as PrismaClient;

    const service = createSingleplayerService({ db });
    const result = await service.createGame({
      difficulty: 'medium',
      ownerUserId: 'user-1',
    });

    expect(result.id).toBe('game-new-1');
    expect(result.playerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(create).toHaveBeenCalledTimes(1);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(findManyRounds).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('deleteGame loads only the game header (no rounds join) and uses idempotent deleteMany', async () => {
    const token = 'tok-delete';
    const findUnique = vi.fn().mockResolvedValue({
      id: 'game-1',
      playerTokenHash: hashPlayerToken(token),
      ownerUserId: null,
      difficulty: 'medium',
      expiresAt: new Date('2100-01-01T00:00:00.000Z'),
    });
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      streetGame: { findUnique, deleteMany },
    } as unknown as PrismaClient;

    const service = createSingleplayerService({ db });
    await service.deleteGame('game-1', token);

    const queryArg = (findUnique.mock.calls[0] as [{ select?: Record<string, unknown>; include?: unknown }])[0];
    expect(queryArg.include).toBeUndefined();
    expect(queryArg.select).toBeDefined();
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'game-1' } });
  });

  it('saveSelection filters rounds to only the target roundId instead of loading full endless history', async () => {
    const token = 'tok-select';
    const findUnique = vi.fn().mockResolvedValue({
      id: 'game-1',
      playerTokenHash: hashPlayerToken(token),
      ownerUserId: null,
      difficulty: 'medium',
      expiresAt: new Date('2100-01-01T00:00:00.000Z'),
      rounds: [
        {
          id: 'round-42',
          gameId: 'game-1',
          number: 42,
          panoId: 'loc:0',
          targetIndex: 0,
          targetLat: 51.5,
          targetLon: -0.1,
          score: null,
          endsAt: new Date('2100-01-01T00:00:00.000Z'),
          candidatesJson: null,
          attempts: [],
        },
      ],
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      streetGame: { findUnique },
      streetRound: { updateMany },
    } as unknown as PrismaClient;

    const service = createSingleplayerService({ db });
    await service.saveSelection('game-1', 'round-42', token, { lat: 48.8, lon: 2.3 });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'game-1' },
        include: {
          rounds: expect.objectContaining({
            where: { id: 'round-42' },
          }),
        },
      }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'round-42', score: null },
      data: { selectionLat: 48.8, selectionLon: 2.3 },
    });
  });
});
