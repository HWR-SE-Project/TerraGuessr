import { describe, expect, it, vi } from 'vitest';

import { purgeExpiredGameSessions } from '../../src/scheduler/purge.js';
import type { SessionPurgeClient } from '../../src/scheduler/purge.js';

const NOW = new Date('2026-11-20T03:00:00.000Z');

function makeDb() {
  const streetGame = { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) };
  const lobby = { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) };
  return {
    db: { streetGame, lobby } as unknown as SessionPurgeClient,
    streetGame,
    lobby,
  };
}

describe('purgeExpiredGameSessions (R18)', () => {
  it('deletes expired solo sessions and lobbies, cascading their result rows', async () => {
    const ctx = makeDb();
    const summary = await purgeExpiredGameSessions(ctx.db, NOW);

    expect(ctx.streetGame.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: NOW } },
    });
    expect(ctx.lobby.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: NOW } },
    });
    expect(summary).toEqual({
      cutoff: NOW,
      deletedStreetGames: 2,
      deletedLobbies: 3,
    });
  });
});
