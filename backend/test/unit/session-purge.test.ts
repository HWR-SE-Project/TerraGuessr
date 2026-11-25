import { describe, expect, it, vi } from 'vitest';

import { purgeExpiredGameSessions } from '../../src/scheduler/purge.js';
import type { SessionPurgeClient } from '../../src/scheduler/purge.js';
import { SETTLEMENT_BATCH_SIZE } from '../../src/domain/settlement.js';

const NOW = new Date('2026-11-20T03:00:00.000Z');

function makeDb() {
  const streetRound = { findMany: vi.fn().mockResolvedValue([]) };
  const lobby = { findMany: vi.fn().mockResolvedValue([]) };
  const lobbyRoundResult = { upsert: vi.fn() };
  const $transaction = vi.fn();
  const counts: Record<string, number> = {};
  const $executeRaw = vi.fn().mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = strings.join(' ');
    if (sql.includes('"StreetGame"')) {
      counts.StreetGame = (counts.StreetGame ?? 0) + 1;
      return counts.StreetGame === 1 ? 500 : 2;
    }
    if (sql.includes('"Lobby"')) {
      counts.Lobby = (counts.Lobby ?? 0) + 1;
      return 3;
    }
    return 0;
  });
  return {
    db: {
      streetRound,
      lobby,
      lobbyRoundResult,
      $transaction,
      $executeRaw,
    } as unknown as SessionPurgeClient,
    streetRound,
    lobby,
    $executeRaw,
    counts,
  };
}

describe('purgeExpiredGameSessions (R18, batched)', () => {
  it('settles timed-out rounds in bounded pages before deleting expired sessions in SKIP LOCKED batches', async () => {
    const ctx = makeDb();
    const summary = await purgeExpiredGameSessions(ctx.db, NOW);

    expect(ctx.streetRound.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: SETTLEMENT_BATCH_SIZE,
        where: expect.objectContaining({
          score: null,
          endsAt: { lte: NOW },
          game: { ownerUserId: { not: null }, expiresAt: { lt: NOW } },
        }),
      }),
    );
    expect(ctx.lobby.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: SETTLEMENT_BATCH_SIZE,
        where: expect.objectContaining({
          status: 'playing',
          expiresAt: { lt: NOW },
        }),
      }),
    );
    expect(ctx.counts.StreetGame).toBe(2);
    expect(ctx.counts.Lobby).toBe(1);
    expect(summary).toEqual({
      cutoff: NOW,
      settledStreetRounds: 0,
      settledLobbyResults: 0,
      deletedStreetGames: 502,
      deletedLobbies: 3,
    });
  });
});
