import './helpers/env.js'; // first: sets DATABASE_URL before any db/prisma import
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import {
  StubWeatherClient,
  buildTestApp,
  setupDatabase,
  teardownDatabase,
} from './helpers/database.js';

interface LobbyBody {
  lobby: {
    lobbyId: string;
    code: string;
    difficulty: 'easy' | 'medium' | 'hard';
    status: string;
    maxPlayers: number;
    roundsTotal: number;
    rules: { timeLimitSeconds: number; attemptsPerRound: number; selectionMode: string };
    members: Array<{ displayName: string | null; isHost: boolean; joinedAt: string }>;
    youAreHost: boolean;
  };
  lobbyToken: string;
}

/** Lobby lifecycle + membership rules (R16). */
describe('lobby lifecycle (integration, R16)', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  const createdCodes: string[] = [];

  beforeAll(async () => {
    prisma = await setupDatabase();
    app = buildTestApp(prisma, new StubWeatherClient());
  });

  afterAll(async () => {
    if (createdCodes.length > 0) {
      await prisma.lobby.deleteMany({ where: { code: { in: createdCodes } } });
    }
    await app.close();
    await teardownDatabase(prisma);
  });

  async function createLobby(
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    displayName = 'Host',
  ): Promise<LobbyBody> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/lobbies',
      payload: { difficulty, displayName },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as LobbyBody;
    createdCodes.push(body.lobby.code);
    return body;
  }

  async function joinLobby(code: string, displayName = 'Guest') {
    return app.inject({
      method: 'POST',
      url: '/api/lobbies/' + code + '/join',
      payload: { displayName },
    });
  }

  it('creates a lobby with the host, a 6-character code and R5 rules', async () => {
    const created = await createLobby('easy', 'Alice');

    expect(created.lobby.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(created.lobbyToken).toEqual(expect.any(String));
    expect(created.lobby.difficulty).toBe('easy');
    expect(created.lobby.status).toBe('waiting');
    expect(created.lobby.maxPlayers).toBe(8);
    expect(created.lobby.roundsTotal).toBe(5);
    expect(created.lobby.rules).toEqual({
      timeLimitSeconds: 420,
      attemptsPerRound: 3,
      selectionMode: 'list',
    });
    expect(created.lobby.members).toHaveLength(1);
    expect(created.lobby.members[0]).toMatchObject({
      displayName: 'Alice',
      isHost: true,
    });

    const fetched = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code,
    });
    expect(fetched.statusCode).toBe(200);
    expect((fetched.json() as LobbyBody['lobby']).members[0]?.displayName).toBe(
      'Alice',
    );

    // The host can identify itself on the public read; a tokenless reader cannot.
    const hostRead = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code,
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect((hostRead.json() as { youAreHost: boolean }).youAreHost).toBe(true);
    expect((fetched.json() as { youAreHost: boolean }).youAreHost).toBe(false);
  });

  it('lets a second player join and shows both members', async () => {
    const created = await createLobby('hard', 'Host');
    const joined = await joinLobby(created.lobby.code, 'Bob');

    expect(joined.statusCode).toBe(201);
    const body = joined.json() as LobbyBody;
    expect(body.lobbyToken).not.toBe(created.lobbyToken);
    expect(body.lobby.members).toHaveLength(2);
    expect(body.lobby.youAreHost).toBe(false);
    expect(body.lobby.members.filter((member) => member.isHost)).toHaveLength(1);
    expect(body.lobby.members.map((member) => member.displayName).sort()).toEqual([
      'Bob',
      'Host',
    ]);
  });

  it('lets a guest leave without affecting the host', async () => {
    const created = await createLobby('medium', 'Host');
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guestToken = (joined.json() as LobbyBody).lobbyToken;

    const left = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/leave',
      headers: { 'x-lobby-token': guestToken },
    });
    expect(left.statusCode).toBe(204);

    const fetched = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code,
    });
    expect(fetched.statusCode).toBe(200);
    expect((fetched.json() as LobbyBody['lobby']).members).toHaveLength(1);
  });

  it('disbands the lobby when the host leaves', async () => {
    const created = await createLobby('medium', 'Host');

    const left = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/leave',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(left.statusCode).toBe(204);

    const fetched = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code,
    });
    expect(fetched.statusCode).toBe(404);
  });

  it('only lets the host delete the lobby explicitly', async () => {
    const created = await createLobby('medium', 'Host');
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guestToken = (joined.json() as LobbyBody).lobbyToken;

    const forbidden = await app.inject({
      method: 'DELETE',
      url: '/api/lobbies/' + created.lobby.code,
      headers: { 'x-lobby-token': guestToken },
    });
    expect(forbidden.statusCode).toBe(403);

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/api/lobbies/' + created.lobby.code,
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(deleted.statusCode).toBe(204);

    const fetched = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code,
    });
    expect(fetched.statusCode).toBe(404);
  });

  it('rejects joining a full lobby with 409', async () => {
    const created = await createLobby('medium', 'Host');
    await prisma.lobby.update({
      where: { code: created.lobby.code },
      data: { maxPlayers: 2 },
    });

    const firstJoin = await joinLobby(created.lobby.code, 'Guest-1');
    expect(firstJoin.statusCode).toBe(201);

    const secondJoin = await joinLobby(created.lobby.code, 'Guest-2');
    expect(secondJoin.statusCode).toBe(409);
  });

  it('rejects joining a lobby that is no longer waiting with 409', async () => {
    const created = await createLobby('medium', 'Host');
    await prisma.lobby.update({
      where: { code: created.lobby.code },
      data: { status: 'playing' },
    });

    const joined = await joinLobby(created.lobby.code, 'Late');
    expect(joined.statusCode).toBe(409);
  });

  it('treats an expired lobby as gone', async () => {
    const created = await createLobby('medium', 'Host');
    await prisma.lobby.update({
      where: { code: created.lobby.code },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const fetched = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code,
    });
    expect(fetched.statusCode).toBe(404);

    const joined = await joinLobby(created.lobby.code, 'Late');
    expect(joined.statusCode).toBe(404);
  });

  it('rejects unknown lobby codes and unknown tokens', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: '/api/lobbies/ZZZ999',
    });
    expect(missing.statusCode).toBe(404);

    const created = await createLobby('medium', 'Host');
    const noToken = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/leave',
    });
    expect(noToken.statusCode).toBe(404);

    const wrongToken = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/leave',
      headers: { 'x-lobby-token': 'not-a-real-token' },
    });
    expect(wrongToken.statusCode).toBe(404);
  });
});
