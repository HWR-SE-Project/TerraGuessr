import { describe, expect, it, vi } from 'vitest';

import {
  generatePlayerToken,
  hashPlayerToken,
} from '../../src/plugins/auth.js';
import { lobbyRulesFor } from '../../src/domain/lobbyRules.js';
import {
  LobbyForbiddenError,
  LobbyNotFoundError,
  createLobby,
  deleteLobby,
  generateLobbyCode,
  getLobby,
  joinLobby,
  leaveLobby,
  type toLobbyView,
} from '../../src/modules/lobbies/service.js';

type PrismaLike = Parameters<typeof createLobby>[1];
type LobbyRow = Parameters<typeof toLobbyView>[0];

const HOST_TOKEN = 'host-token';
const HOST_HASH = hashPlayerToken(HOST_TOKEN);
const FAR_FUTURE = new Date('2100-01-01T00:00:00.000Z');
const CREATED_AT = new Date('2026-11-20T12:00:00.000Z');

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    lobbyId: 'lobby-1',
    playerTokenHash: HOST_HASH,
    displayName: 'Host',
    joinedAt: CREATED_AT,
    ...overrides,
  };
}

function lobbyRow(overrides: Record<string, unknown> = {}): LobbyRow {
  return {
    id: 'lobby-1',
    code: 'ABC234',
    difficulty: 'medium',
    hostTokenHash: HOST_HASH,
    roundsTotal: 5,
    status: 'waiting',
    createdAt: CREATED_AT,
    expiresAt: FAR_FUTURE,
    members: [member()],
    ...overrides,
  } as LobbyRow;
}

describe('lobby difficulty rules (R5)', () => {
  it('maps each difficulty to its time limit, attempts and selection mode', () => {
    expect(lobbyRulesFor('easy')).toEqual({
      timeLimitSeconds: 420,
      attemptsPerRound: 3,
      selectionMode: 'list',
    });
    expect(lobbyRulesFor('medium')).toEqual({
      timeLimitSeconds: 240,
      attemptsPerRound: 2,
      selectionMode: 'map',
    });
    expect(lobbyRulesFor('hard')).toEqual({
      timeLimitSeconds: 120,
      attemptsPerRound: 1,
      selectionMode: 'map',
    });
  });
});

describe('generateLobbyCode', () => {
  it('returns six unambiguous uppercase characters', () => {
    const code = generateLobbyCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('uses the injected random source', () => {
    expect(generateLobbyCode(() => 0)).toBe('AAAAAA');
    expect(generateLobbyCode(() => 7)).toBe('HHHHHH');
  });
});

describe('createLobby', () => {
  it('creates the host member and returns the raw token once', async () => {
    const create = vi.fn().mockImplementation(async (args: { data: unknown }) => {
      const data = args.data as Record<string, unknown>;
      return {
        ...data,
        id: 'lobby-1',
        status: 'waiting',
        createdAt: CREATED_AT,
        members: [member({ playerTokenHash: data.hostTokenHash })],
      };
    });
    const db = { lobby: { create } } as unknown as PrismaLike;

    const result = await createLobby(
      { difficulty: 'easy', displayName: '  Alice  ' },
      db,
    );

    expect(result.lobbyToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.lobby.difficulty).toBe('easy');
    expect(result.lobby.rules.selectionMode).toBe('list');
    expect(result.lobby.members[0]?.isHost).toBe(true);

    const data = (create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0]
      .data;
    expect(data.hostTokenHash).toBe(hashPlayerToken(result.lobbyToken));
    expect(data.hostTokenHash).not.toBe(result.lobbyToken);
    expect((data.members as { create: { displayName: string } }).create.displayName).toBe('Alice');
    expect(data.roundsTotal).toBe(5);
  });

  it('persists a host-selected round count', async () => {
    const create = vi.fn().mockImplementation(async (args: { data: unknown }) => {
      const data = args.data as Record<string, unknown>;
      return {
        ...data,
        id: 'lobby-1',
        status: 'waiting',
        createdAt: CREATED_AT,
        members: [member({ playerTokenHash: data.hostTokenHash })],
      };
    });
    const db = { lobby: { create } } as unknown as PrismaLike;

    const result = await createLobby(
      { difficulty: 'medium', roundsTotal: 9 },
      db,
    );

    expect(result.lobby.roundsTotal).toBe(9);
    const data = (create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0]
      .data;
    expect(data.roundsTotal).toBe(9);
  });

  it('retries on a code collision and then succeeds', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValue({
        id: 'lobby-1',
        code: 'ZZZ234',
        difficulty: 'hard',
        hostTokenHash: HOST_HASH,
        roundsTotal: 5,
        status: 'waiting',
        createdAt: CREATED_AT,
        expiresAt: FAR_FUTURE,
        members: [member()],
      });
    const db = { lobby: { create } } as unknown as PrismaLike;

    const result = await createLobby({ difficulty: 'hard' }, db);

    expect(result.lobby.code).toBe('ZZZ234');
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe('getLobby', () => {
  it('maps members, marks the host and derives rules', async () => {
    const guestHash = hashPlayerToken('guest-token');
    const db = {
      lobby: {
        findUnique: vi.fn().mockResolvedValue(
          lobbyRow({
            members: [
              member(),
              member({
                id: 'member-2',
                playerTokenHash: guestHash,
                displayName: null,
                joinedAt: new Date('2026-11-20T12:01:00.000Z'),
              }),
            ],
          }),
        ),
      },
    } as unknown as PrismaLike;

    const view = await getLobby('ABC234', db);

    expect(view.members).toHaveLength(2);
    expect(view.members[0]).toMatchObject({ displayName: 'Host', isHost: true });
    expect(view.members[1]).toMatchObject({ displayName: null, isHost: false });
    expect(view.rules).toEqual({
      timeLimitSeconds: 240,
      attemptsPerRound: 2,
      selectionMode: 'map',
    });
  });

  it('treats an expired lobby as not found', async () => {
    const db = {
      lobby: {
        findUnique: vi
          .fn()
          .mockResolvedValue(lobbyRow({ expiresAt: new Date(0) })),
      },
    } as unknown as PrismaLike;

    await expect(getLobby('ABC234', db)).rejects.toBeInstanceOf(
      LobbyNotFoundError,
    );
  });
});

describe('joinLobby', () => {
  it('adds a member with a fresh token', async () => {
    const guestHash = hashPlayerToken('guest-token');
    const createdMember = member({
      id: 'member-2',
      playerTokenHash: guestHash,
      displayName: 'Bob',
      joinedAt: new Date('2026-11-20T12:02:00.000Z'),
    });
    const db = {
      lobby: { findUnique: vi.fn().mockResolvedValue(lobbyRow()) },
      lobbyMember: { create: vi.fn().mockResolvedValue(createdMember) },
    } as unknown as PrismaLike;

    const result = await joinLobby('ABC234', { displayName: 'Bob' }, db);

    expect(result.lobby.members).toHaveLength(2);
    expect(result.lobby.members[1]?.displayName).toBe('Bob');
    expect(result.lobbyToken).not.toBe(HOST_TOKEN);
    const createData = (
      db.lobbyMember.create as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0][0].data;
    expect(createData.playerTokenHash).toBe(hashPlayerToken(result.lobbyToken));
  });

  it('rejects joining a lobby that is already playing with 409', async () => {
    const db = {
      lobby: {
        findUnique: vi
          .fn()
          .mockResolvedValue(lobbyRow({ status: 'playing' })),
      },
    } as unknown as PrismaLike;

    await expect(joinLobby('ABC234', {}, db)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('leaveLobby', () => {
  it('deletes the lobby when the host leaves', async () => {
    const del = vi.fn().mockResolvedValue({});
    const db = {
      lobby: {
        findUnique: vi.fn().mockResolvedValue(lobbyRow()),
        delete: del,
      },
    } as unknown as PrismaLike;

    await leaveLobby('ABC234', HOST_TOKEN, db);

    expect(del).toHaveBeenCalledWith({ where: { id: 'lobby-1' } });
  });

  it('keeps a started match alive and promotes a guest when the host leaves', async () => {
    const guestToken = 'guest-token';
    const guestHash = hashPlayerToken(guestToken);
    const deleteHost = vi.fn().mockResolvedValue({});
    const updateLobby = vi.fn().mockResolvedValue({});
    const tx = {
      lobbyMember: { deleteMany: deleteHost },
      lobby: { update: updateLobby },
    };
    const db = {
      lobby: {
        findUnique: vi.fn().mockResolvedValue(
          lobbyRow({
            status: 'playing',
            members: [
              member(),
              member({
                id: 'member-2',
                playerTokenHash: guestHash,
                displayName: 'Guest',
                joinedAt: new Date('2026-11-20T12:01:00.000Z'),
              }),
            ],
          }),
        ),
        delete: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaLike;

    await leaveLobby('ABC234', HOST_TOKEN, db);

    expect((db.lobby.delete as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect(deleteHost).toHaveBeenCalledWith({
      where: { lobbyId: 'lobby-1', playerTokenHash: HOST_HASH },
    });
    expect(updateLobby).toHaveBeenCalledWith({
      where: { id: 'lobby-1' },
      data: { hostTokenHash: guestHash },
    });
  });

  it('removes only the member when a guest leaves', async () => {
    const guestToken = 'guest-token';
    const deleteMember = vi.fn().mockResolvedValue({});
    const db = {
      lobby: {
        findUnique: vi.fn().mockResolvedValue(
          lobbyRow({
            members: [
              member(),
              member({ id: 'member-2', playerTokenHash: hashPlayerToken(guestToken) }),
            ],
          }),
        ),
        delete: vi.fn(),
      },
      lobbyMember: { delete: deleteMember },
    } as unknown as PrismaLike;

    await leaveLobby('ABC234', guestToken, db);

    expect(deleteMember).toHaveBeenCalledWith({ where: { id: 'member-2' } });
    expect((db.lobby.delete as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('rejects an unknown token with 404', async () => {
    const db = {
      lobby: { findUnique: vi.fn().mockResolvedValue(lobbyRow()) },
    } as unknown as PrismaLike;

    await expect(leaveLobby('ABC234', 'nope', db)).rejects.toBeInstanceOf(
      LobbyNotFoundError,
    );
  });
});

describe('deleteLobby', () => {
  it('lets the host delete the lobby', async () => {
    const del = vi.fn().mockResolvedValue({});
    const db = {
      lobby: {
        findUnique: vi.fn().mockResolvedValue(lobbyRow()),
        delete: del,
      },
    } as unknown as PrismaLike;

    await deleteLobby('ABC234', HOST_TOKEN, db);

    expect(del).toHaveBeenCalledWith({ where: { id: 'lobby-1' } });
  });

  it('rejects a non-host member with 403 and an unknown token with 404', async () => {
    const guestToken = generatePlayerToken();
    const db = {
      lobby: {
        findUnique: vi.fn().mockResolvedValue(
          lobbyRow({
            members: [
              member(),
              member({ id: 'member-2', playerTokenHash: hashPlayerToken(guestToken) }),
            ],
          }),
        ),
      },
    } as unknown as PrismaLike;

    await expect(
      deleteLobby('ABC234', guestToken, db),
    ).rejects.toBeInstanceOf(LobbyForbiddenError);
    await expect(
      deleteLobby('ABC234', 'unknown', db),
    ).rejects.toBeInstanceOf(LobbyNotFoundError);
  });
});
