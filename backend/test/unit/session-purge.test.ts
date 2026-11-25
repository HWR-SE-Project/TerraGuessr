import { describe, expect, it, vi } from 'vitest';

import { purgeExpiredGameSessions } from '../../src/scheduler/purge.js';
import type { SessionPurgeClient } from '../../src/scheduler/purge.js';

const NOW = new Date('2026-11-20T03:00:00.000Z');

function makeDb() {
  const streetGame = { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) };
  const streetRound = { findMany: vi.fn().mockResolvedValue([]) };
  const lobby = {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
  };
  const lobbyRoundResult = { upsert: vi.fn() };
  const $transaction = vi.fn();
  return {
    db: { streetGame, streetRound, lobby, lobbyRoundResult, $transaction } as unknown as SessionPurgeClient,
    streetGame,
    streetRound,
    lobby,
  };
}

describe('purgeExpiredGameSessions (R18)', () => {
  it('settles timed-out rounds on expired sessions before deleting them', async () => {
    const ctx = makeDb();
    const summary = await purgeExpiredGameSessions(ctx.db, NOW);

    expect(ctx.streetRound.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          score: null,
          endsAt: { lte: NOW },
          game: { ownerUserId: { not: null }, expiresAt: { lt: NOW } },
        }),
      }),
    );
    expect(ctx.lobby.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'playing',
          expiresAt: { lt: NOW },
        }),
      }),
    );
    expect(ctx.streetGame.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: NOW } },
    });
    expect(ctx.lobby.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: NOW } },
    });
    expect(summary).toEqual({
      cutoff: NOW,
      settledStreetRounds: 0,
      settledLobbyResults: 0,
      deletedStreetGames: 2,
      deletedLobbies: 3,
    });
  });
});
