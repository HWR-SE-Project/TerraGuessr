import { describe, expect, it, vi } from 'vitest';

import { Prisma } from '@prisma/client';

import {
  generatePlayerToken,
  hashPlayerToken,
} from '../../src/plugins/auth.js';
import {
  LOBBY_ROUND_REVIEW_MS,
  MAX_LOBBY_MEMBERS,
} from '../../src/config/constants.js';
import { gameRulesFor } from '../../src/domain/gameRules.js';
import {
  LobbyConflictError,
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
import {
  continueLobbyRoundReview,
  getLobbyMatch,
} from '../../src/modules/lobbies/match.js';

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

describe('lobby difficulty rules', () => {
  it('maps each difficulty to its time limit, attempts and selection mode', () => {
    expect(gameRulesFor('easy')).toEqual({
      timeLimitSeconds: 420,
      attemptsPerRound: 3,
      selectionMode: 'list',
      countryBorders: true,
      extraData: { mode: 'free' },
    });
    expect(gameRulesFor('medium')).toEqual({
      timeLimitSeconds: 240,
      attemptsPerRound: 2,
      selectionMode: 'map',
      countryBorders: true,
      extraData: { mode: 'points', cost: 100 },
    });
    expect(gameRulesFor('hard')).toEqual({
      timeLimitSeconds: 120,
      attemptsPerRound: 1,
      selectionMode: 'map',
      countryBorders: true,
      extraData: { mode: 'time', cost: 20 },
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
    expect(result.lobby.maxMembers).toBe(MAX_LOBBY_MEMBERS);
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
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      )
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

    const view = await getLobby('ABC234', db, 'guest-token');

    expect(view.members).toHaveLength(2);
    expect(view.maxMembers).toBe(MAX_LOBBY_MEMBERS);
    expect(view.members[0]).toMatchObject({ displayName: 'Host', isHost: true, isYou: false });
    expect(view.members[1]).toMatchObject({ displayName: null, isHost: false, isYou: true });
    expect(view.rules).toEqual({
      timeLimitSeconds: 240,
      attemptsPerRound: 2,
      selectionMode: 'map',
      countryBorders: true,
      extraData: { mode: 'points', cost: 100 },
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
  function joinDb(row: LobbyRow, createdMember?: ReturnType<typeof member>) {
    const queryRaw = vi.fn().mockResolvedValue([{ id: row.id }]);
    const findUnique = vi.fn().mockResolvedValue(row);
    const create = vi.fn().mockResolvedValue(createdMember);
    const tx = {
      $queryRaw: queryRaw,
      lobby: { findUnique },
      lobbyMember: { create },
    };
    const db = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaLike;
    return { db, queryRaw, findUnique, create };
  }

  it('adds a member with a fresh token inside a locked transaction', async () => {
    const guestHash = hashPlayerToken('guest-token');
    const createdMember = member({
      id: 'member-2',
      playerTokenHash: guestHash,
      displayName: 'Bob',
      joinedAt: new Date('2026-11-20T12:02:00.000Z'),
    });
    const { db, queryRaw, create } = joinDb(lobbyRow(), createdMember);

    const result = await joinLobby('ABC234', { displayName: 'Bob' }, db);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.lobby.members).toHaveLength(2);
    expect(result.lobby.maxMembers).toBe(MAX_LOBBY_MEMBERS);
    expect(result.lobby.members[1]?.displayName).toBe('Bob');
    expect(result.lobbyToken).not.toBe(HOST_TOKEN);
    const createData = (create.mock.calls[0] as [{ data: { playerTokenHash: string } }])[0]
      .data;
    expect(createData.playerTokenHash).toBe(hashPlayerToken(result.lobbyToken));
  });

  it('rejects joining a lobby that is already playing with 409', async () => {
    const { db, create } = joinDb(lobbyRow({ status: 'playing' }));

    await expect(joinLobby('ABC234', {}, db)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects joining a lobby that has reached MAX_LOBBY_MEMBERS with 409', async () => {
    const fullMembers = Array.from({ length: MAX_LOBBY_MEMBERS }, (_, i) =>
      member({
        id: `member-${i + 1}`,
        playerTokenHash: i === 0 ? HOST_HASH : hashPlayerToken(`guest-${i}`),
        displayName: `Player ${i + 1}`,
      }),
    );
    const { db, create } = joinDb(lobbyRow({ members: fullMembers }));

    await expect(joinLobby('ABC234', { displayName: 'Overflow' }, db)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof LobbyConflictError &&
        err.statusCode === 409 &&
        /full/i.test(err.message),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('disambiguates duplicate display names case-insensitively and within 40 chars', async () => {
    const existing = [
      member({ id: 'member-1', displayName: 'Alex' }),
      member({
        id: 'member-2',
        playerTokenHash: hashPlayerToken('guest-2'),
        displayName: 'Alex (2)',
      }),
    ];
    const createdMember = member({
      id: 'member-3',
      playerTokenHash: hashPlayerToken('guest-3'),
      displayName: 'alex (3)',
      joinedAt: new Date('2026-11-20T12:03:00.000Z'),
    });
    const { db, create } = joinDb(lobbyRow({ members: existing }), createdMember);

    await joinLobby('ABC234', { displayName: 'alex' }, db);

    const createData = (create.mock.calls[0] as [{ data: { displayName: string } }])[0].data;
    expect(createData.displayName).toBe('alex (3)');

    const longName = 'A'.repeat(40);
    const longMember = member({
      id: 'member-4',
      playerTokenHash: hashPlayerToken('guest-4'),
      displayName: `${'A'.repeat(36)} (2)`,
    });
    const longJoin = joinDb(
      lobbyRow({ members: [member({ displayName: longName })] }),
      longMember,
    );

    await joinLobby('ABC234', { displayName: longName }, longJoin.db);

    const longData = (longJoin.create.mock.calls[0] as [{ data: { displayName: string } }])[0].data;
    expect(longData.displayName).toBe(`${'A'.repeat(36)} (2)`);
    expect(longData.displayName.length).toBe(40);
  });
});

describe('getLobbyMatch idle polling', () => {
  function matchLobbyRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'lobby-1',
      code: 'ABC234',
      difficulty: 'medium',
      matchId: 'match-1',
      hostTokenHash: HOST_HASH,
      roundsTotal: 5,
      status: 'playing',
      currentRound: 1,
      startedAt: CREATED_AT,
      finishedAt: null,
      createdAt: CREATED_AT,
      expiresAt: FAR_FUTURE,
      members: [
        member({
          selectionLat: null,
          selectionLon: null,
          continueRequestedAt: null,
          userId: null,
        }),
        member({
          id: 'member-2',
          playerTokenHash: hashPlayerToken('guest-token'),
          displayName: 'Guest',
          selectionLat: null,
          selectionLon: null,
          continueRequestedAt: null,
          userId: null,
        }),
      ],
      rounds: [
        {
          id: 'round-1',
          lobbyId: 'lobby-1',
          number: 1,
          panoId: 'loc:0',
          targetIndex: 0,
          targetLat: 51.5074,
          targetLon: -0.1278,
          placeName: 'London',
          sceneJson: {
            biome: 'urban',
            weather: 'clear',
            lighting: 'day',
            temperatureBand: 'mild',
            windBand: 'calm',
            seed: 42,
          },
          candidatesJson: null,
          startedAt: CREATED_AT,
          endsAt: FAR_FUTURE,
          reviewEndsAt: null,
          weatherValidUntil: FAR_FUTURE,
          weatherAttemptedIndices: [0],
          weatherExhausted: false,
          createdAt: CREATED_AT,
          attempts: [],
          results: [],
          memberStates: [],
        },
      ],
      ...overrides,
    };
  }

  it('loads the lobby only once on an idle playing poll when no state transition occurs', async () => {
    const findUnique = vi.fn().mockResolvedValue(matchLobbyRow());
    const db = { lobby: { findUnique } } as unknown as PrismaLike;

    const response = await getLobbyMatch('ABC234', HOST_TOKEN, db);

    expect(response.match.status).toBe('playing');
    expect(response.match.currentRound).toBe(1);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('loads the lobby only once on an idle finished poll before any rematch request', async () => {
    const findUnique = vi.fn().mockResolvedValue(
      matchLobbyRow({
        status: 'finished',
        finishedAt: CREATED_AT,
      }),
    );
    const db = { lobby: { findUnique } } as unknown as PrismaLike;

    const response = await getLobbyMatch('ABC234', HOST_TOKEN, db);

    expect(response.match.status).toBe('finished');
    expect(response.match.continuePrompt?.deadline).toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('loads the lobby only once during the active rematch wait window while players are pending', async () => {
    const now = new Date();
    const row = matchLobbyRow({
      status: 'finished',
      finishedAt: now,
      members: [
        member({
          selectionLat: null,
          selectionLon: null,
          continueRequestedAt: now,
          userId: null,
        }),
        member({
          id: 'member-2',
          playerTokenHash: hashPlayerToken('guest-token'),
          displayName: 'Guest',
          selectionLat: null,
          selectionLon: null,
          continueRequestedAt: null,
          userId: null,
        }),
      ],
    });
    const findUnique = vi.fn().mockResolvedValue(row);
    const db = { lobby: { findUnique } } as unknown as PrismaLike;

    const response = await getLobbyMatch('ABC234', HOST_TOKEN, db);

    expect(response.match.status).toBe('finished');
    expect(response.match.continuePrompt?.youRequested).toBe(true);
    expect(response.match.continuePrompt?.pendingPlayers).toEqual(['Guest']);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('uses a 15-second review window and reports review readiness on an idle review poll', async () => {
    expect(LOBBY_ROUND_REVIEW_MS).toBe(15_000);
    const now = new Date();
    const row = matchLobbyRow({
      rounds: [
        {
          id: 'round-1',
          lobbyId: 'lobby-1',
          number: 1,
          panoId: 'loc:0',
          targetIndex: 0,
          targetLat: 51.5074,
          targetLon: -0.1278,
          placeName: 'London',
          sceneJson: {
            biome: 'urban',
            weather: 'clear',
            lighting: 'day',
            temperatureBand: 'mild',
            windBand: 'calm',
            seed: 42,
          },
          candidatesJson: null,
          startedAt: CREATED_AT,
          endsAt: FAR_FUTURE,
          reviewEndsAt: new Date(now.getTime() + LOBBY_ROUND_REVIEW_MS),
          weatherValidUntil: FAR_FUTURE,
          weatherAttemptedIndices: [0],
          weatherExhausted: false,
          createdAt: CREATED_AT,
          attempts: [],
          results: [],
          memberStates: [
            {
              id: 'state-1',
              roundId: 'round-1',
              memberId: 'member-1',
              extraDataUnlockedAt: null,
              extraDataPointsSpent: 0,
              endsAt: null,
              reviewReadyAt: now,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      ],
    });
    const findUnique = vi.fn().mockResolvedValue(row);
    const db = { lobby: { findUnique } } as unknown as PrismaLike;

    const response = await getLobbyMatch('ABC234', HOST_TOKEN, db);

    expect(response.match.reviewPrompt).toEqual({
      readyPlayers: ['Host'],
      pendingPlayers: ['Guest'],
      youReady: true,
    });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('records review readiness in continueLobbyRoundReview and rejects rounds not in review', async () => {
    const notInReviewDb = {
      lobby: { findUnique: vi.fn().mockResolvedValue(matchLobbyRow()) },
    } as unknown as PrismaLike;
    await expect(
      continueLobbyRoundReview('ABC234', 1, HOST_TOKEN, notInReviewDb),
    ).rejects.toBeInstanceOf(LobbyConflictError);

    const now = new Date();
    const reviewEndsAt = new Date(now.getTime() + LOBBY_ROUND_REVIEW_MS);
    const beforeRow = matchLobbyRow({
      rounds: [
        {
          id: 'round-1',
          lobbyId: 'lobby-1',
          number: 1,
          panoId: 'loc:0',
          targetIndex: 0,
          targetLat: 51.5074,
          targetLon: -0.1278,
          placeName: 'London',
          sceneJson: {
            biome: 'urban',
            weather: 'clear',
            lighting: 'day',
            temperatureBand: 'mild',
            windBand: 'calm',
            seed: 42,
          },
          candidatesJson: null,
          startedAt: CREATED_AT,
          endsAt: FAR_FUTURE,
          reviewEndsAt,
          weatherValidUntil: FAR_FUTURE,
          weatherAttemptedIndices: [0],
          weatherExhausted: false,
          createdAt: CREATED_AT,
          attempts: [],
          results: [],
          memberStates: [],
        },
      ],
    });
    const afterRow = matchLobbyRow({
      rounds: [
        {
          ...beforeRow.rounds[0],
          memberStates: [
            {
              id: 'state-1',
              roundId: 'round-1',
              memberId: 'member-1',
              extraDataUnlockedAt: null,
              extraDataPointsSpent: 0,
              endsAt: null,
              reviewReadyAt: now,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      ],
    });
    const upsert = vi.fn().mockResolvedValue({});
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(beforeRow)
      .mockResolvedValueOnce(afterRow);
    const db = {
      lobby: { findUnique },
      lobbyRoundMemberState: { upsert },
    } as unknown as PrismaLike;

    const response = await continueLobbyRoundReview('ABC234', 1, HOST_TOKEN, db);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(response.match.currentRound).toBe(1);
    expect(response.match.reviewPrompt).toEqual({
      readyPlayers: ['Host'],
      pendingPlayers: ['Guest'],
      youReady: true,
    });
  });

  it('finishes the match early when all players continue on the final round review', async () => {
    const now = new Date();
    const reviewEndsAt = new Date(now.getTime() + LOBBY_ROUND_REVIEW_MS);
    const roundBase = {
      id: 'round-1',
      lobbyId: 'lobby-1',
      number: 1,
      panoId: 'loc:0',
      targetIndex: 0,
      targetLat: 51.5074,
      targetLon: -0.1278,
      placeName: 'London',
      sceneJson: {
        biome: 'urban',
        weather: 'clear',
        lighting: 'day',
        temperatureBand: 'mild',
        windBand: 'calm',
        seed: 42,
      },
      candidatesJson: null,
      startedAt: CREATED_AT,
      endsAt: FAR_FUTURE,
      reviewEndsAt,
      weatherValidUntil: FAR_FUTURE,
      weatherAttemptedIndices: [0],
      weatherExhausted: false,
      createdAt: CREATED_AT,
      attempts: [],
      results: [],
    };
    const guestReadyState = {
      id: 'state-2',
      roundId: 'round-1',
      memberId: 'member-2',
      extraDataUnlockedAt: null,
      extraDataPointsSpent: 0,
      endsAt: null,
      reviewReadyAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const hostReadyState = {
      id: 'state-1',
      roundId: 'round-1',
      memberId: 'member-1',
      extraDataUnlockedAt: null,
      extraDataPointsSpent: 0,
      endsAt: null,
      reviewReadyAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const beforeRow = matchLobbyRow({
      roundsTotal: 1,
      rounds: [{ ...roundBase, memberStates: [guestReadyState] }],
    });
    const bothReadyRow = matchLobbyRow({
      roundsTotal: 1,
      rounds: [{ ...roundBase, memberStates: [guestReadyState, hostReadyState] }],
    });
    const finishedRow = matchLobbyRow({
      roundsTotal: 1,
      status: 'finished',
      finishedAt: now,
      rounds: [{ ...roundBase, memberStates: [guestReadyState, hostReadyState] }],
    });
    const upsert = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(beforeRow)
      .mockResolvedValueOnce(bothReadyRow)
      .mockResolvedValueOnce(finishedRow);
    const db = {
      lobby: { findUnique, updateMany },
      lobbyRoundMemberState: { upsert },
    } as unknown as PrismaLike;

    const response = await continueLobbyRoundReview('ABC234', 1, HOST_TOKEN, db);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(response.match.status).toBe('finished');
    expect(response.match.reviewPrompt).toBeNull();
  });
});

describe('leaveLobby', () => {
  function leaveDb(row: LobbyRow) {
    const queryRaw = vi.fn().mockResolvedValue([{ id: row.id }]);
    const findUnique = vi.fn().mockResolvedValue(row);
    const deleteLobbyMock = vi.fn().mockResolvedValue({});
    const updateLobby = vi.fn().mockResolvedValue({});
    const deleteMembers = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: queryRaw,
      lobby: {
        findUnique,
        delete: deleteLobbyMock,
        update: updateLobby,
      },
      lobbyMember: {
        deleteMany: deleteMembers,
      },
    };
    const db = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaLike;
    return { db, queryRaw, deleteLobbyMock, updateLobby, deleteMembers };
  }

  it('deletes the lobby when the host leaves while waiting', async () => {
    const { db, queryRaw, deleteLobbyMock } = leaveDb(lobbyRow());

    await leaveLobby('ABC234', HOST_TOKEN, db);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(deleteLobbyMock).toHaveBeenCalledWith({ where: { id: 'lobby-1' } });
  });

  it('keeps a started match alive and promotes a guest atomically when the host leaves', async () => {
    const guestToken = 'guest-token';
    const guestHash = hashPlayerToken(guestToken);
    const { db, queryRaw, deleteLobbyMock, updateLobby, deleteMembers } = leaveDb(
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
    );

    await leaveLobby('ABC234', HOST_TOKEN, db);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(deleteLobbyMock).not.toHaveBeenCalled();
    expect(deleteMembers).toHaveBeenCalledWith({
      where: { lobbyId: 'lobby-1', playerTokenHash: HOST_HASH },
    });
    expect(updateLobby).toHaveBeenCalledWith({
      where: { id: 'lobby-1' },
      data: { hostTokenHash: guestHash },
    });
  });

  it('removes only the member idempotently when a guest leaves', async () => {
    const guestToken = 'guest-token';
    const { db, queryRaw, deleteLobbyMock, deleteMembers } = leaveDb(
      lobbyRow({
        members: [
          member(),
          member({ id: 'member-2', playerTokenHash: hashPlayerToken(guestToken) }),
        ],
      }),
    );

    await leaveLobby('ABC234', guestToken, db);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(deleteMembers).toHaveBeenCalledWith({ where: { id: 'member-2' } });
    expect(deleteLobbyMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown token with 404', async () => {
    const { db } = leaveDb(lobbyRow());

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
