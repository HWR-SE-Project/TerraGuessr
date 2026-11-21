import './helpers/env.js'; // first: sets DATABASE_URL before any db/prisma import
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import {
  buildTestApp,
  setupDatabase,
  teardownDatabase,
} from './helpers/database.js';
import type { PanoramaProvider } from '../../src/modules/singleplayer/provider.js';
import type { IntelligenceLookup } from '../../src/modules/singleplayer/locationSelection.js';
import { createUserSession } from '../../src/modules/auth/service.js';

const MATCH_TARGETS = [
  { lat: 51.5009, lon: -0.1246 },
  { lat: 48.853, lon: 2.3499 },
  { lat: 41.8902, lon: 12.4923 },
  { lat: 40.4168, lon: -3.7038 },
  { lat: 52.3702, lon: 4.8952 },
  { lat: 59.9139, lon: 10.7522 },
  { lat: 55.6761, lon: 12.5683 },
  { lat: 47.3769, lon: 8.5417 },
] as const;

const matchProvider: PanoramaProvider = async (used) => {
  const index = MATCH_TARGETS.findIndex((_, candidate) => !used.includes(candidate));
  if (index < 0) throw new Error('No test targets remain');
  const target = MATCH_TARGETS[index]!;
  return {
    panoId: `test-pano-${index}`,
    targetIndex: index,
    lat: target.lat,
    lon: target.lon,
  };
};

const matchIntelligence: IntelligenceLookup = async () => ({
  fetchedAt: new Date().toISOString(),
  cached: false,
  weather: {
    modelTime: '2026-11-20T12:00',
    temperatureC: 18,
    condition: 'Clear sky',
    windSpeedKmh: 10,
    windDirectionDeg: 180,
    humidityPct: 55,
    pressureHpa: 1012,
    precipitationMm: 0,
    precipitationIntervalMinutes: 60,
  },
  environment: {
    elevationM: 20,
    reliefM: 5,
    terrain: 'Low relief',
    biome: null,
    vegetation: null,
  },
  climate: null,
});

interface LobbyBody {
  lobby: {
    lobbyId: string;
    code: string;
    difficulty: 'easy' | 'medium' | 'hard';
    status: string;
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
  const userIds: string[] = [];

  beforeAll(async () => {
    prisma = await setupDatabase();
    app = buildTestApp(prisma, {
      provider: matchProvider,
      intelligence: matchIntelligence,
    });
  });

  async function signIn(name: string) {
    const user = await prisma.user.create({
      data: {
        email: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
        displayName: name,
      },
    });
    userIds.push(user.id);
    const token = await createUserSession(prisma, user.id);
    return { user, cookie: `tg_session=${token}` };
  }

  afterAll(async () => {
    if (createdCodes.length > 0) {
      await prisma.lobby.deleteMany({ where: { code: { in: createdCodes } } });
    }
    if (userIds.length > 0) {
      await prisma.gameResult.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
    await teardownDatabase(prisma);
  });

  async function createLobby(
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    displayName = 'Host',
    roundsTotal?: number,
    cookie?: string,
  ): Promise<LobbyBody> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/lobbies',
      headers: cookie ? { cookie } : undefined,
      payload: {
        difficulty,
        displayName,
        ...(roundsTotal === undefined ? {} : { roundsTotal }),
      },
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

  async function finishRound(
    code: string,
    roundNumber: number,
    token: string,
  ): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: `/api/lobbies/${code}/rounds/${roundNumber}/guess`,
      headers: { 'x-lobby-token': token },
      payload: { lat: 51.5, lon: -0.12, final: true },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { finalized: boolean }).finalized).toBe(true);
  }

  async function finishMatch(
    code: string,
    tokens: string[],
    roundsTotal = 5,
  ): Promise<void> {
    for (let round = 1; round <= roundsTotal; round += 1) {
      for (const token of tokens) {
        await finishRound(code, round, token);
      }
      // Advance the shared round (or finish the lobby) once everyone is done.
      const advance = await app.inject({
        method: 'GET',
        url: `/api/lobbies/${code}/match`,
        headers: { 'x-lobby-token': tokens[0]! },
      });
      expect(advance.statusCode).toBe(200);
    }
  }

  it('creates a lobby with the host, a 6-character code and R5 rules', async () => {
    const created = await createLobby('easy', 'Alice');

    expect(created.lobby.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(created.lobbyToken).toEqual(expect.any(String));
    expect(created.lobby.difficulty).toBe('easy');
    expect(created.lobby.status).toBe('waiting');
    expect(created.lobby.roundsTotal).toBe(5);
    expect(created.lobby.rules).toEqual({
      timeLimitSeconds: 420,
      attemptsPerRound: 3,
      selectionMode: 'list',
      countryBorders: true,
      extraData: { mode: 'free' },
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

  it('honours the host-selected round count and rejects out-of-range values', async () => {
    const created = await createLobby('medium', 'Host', 3);
    expect(created.lobby.roundsTotal).toBe(3);

    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;
    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    await finishMatch(
      created.lobby.code,
      [created.lobbyToken, guest.lobbyToken],
      3,
    );

    const finished = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(finished.statusCode).toBe(200);
    const finishedBody = finished.json() as {
      match: { status: string; results: Array<{ roundNumber: number }> };
    };
    expect(finishedBody.match.status).toBe('finished');
    expect(finishedBody.match.results).toHaveLength(3);

    for (const roundsTotal of [2, 11, 2.5]) {
      const invalid = await app.inject({
        method: 'POST',
        url: '/api/lobbies',
        payload: { difficulty: 'medium', roundsTotal },
      });
      expect(invalid.statusCode).toBe(400);
    }
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

  it('keeps a started match alive when the host leaves and promotes a guest', async () => {
    const created = await createLobby('medium', 'Host');
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;

    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });

    const left = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/leave',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(left.statusCode).toBe(204);

    const fetched = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code,
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    expect(fetched.statusCode).toBe(200);
    const body = fetched.json() as LobbyBody['lobby'];
    expect(body.status).toBe('playing');
    expect(body.members).toHaveLength(1);
    expect(body.members[0]).toMatchObject({ displayName: 'Guest', isHost: true });
    expect(body.youAreHost).toBe(true);

    const guestMatch = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    expect(guestMatch.statusCode).toBe(200);
    expect(
      (guestMatch.json() as { match: { status: string; currentRound: number } })
        .match,
    ).toMatchObject({ status: 'playing', currentRound: 1 });

    const hostMatch = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(hostMatch.statusCode).toBe(404);
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

  it('rejects starting a match with only the host present', async () => {
    const created = await createLobby('medium', 'Host');

    const started = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(started.statusCode).toBe(409);
    expect((started.json() as { error: { message: string } }).error.message).toMatch(
      /at least two players/i,
    );
  });

  it('starts a shared match for the host and exposes the same round to everyone', async () => {
    const created = await createLobby('easy', 'Host');
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;

    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    expect(forbidden.statusCode).toBe(403);

    const started = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(started.statusCode).toBe(200);
    const hostMatch = started.json() as {
      match: {
        status: string;
        currentRound: number;
        round: { number: number; panoId: string; candidates?: unknown[] } | null;
        you: { attemptsTotal: number; finalized: boolean };
      };
    };
    expect(hostMatch.match.status).toBe('playing');
    expect(hostMatch.match.currentRound).toBe(1);
    expect(hostMatch.match.round?.number).toBe(1);
    expect(hostMatch.match.round?.panoId).toBe('test-pano-0');
    expect(hostMatch.match.round?.candidates).toHaveLength(6);
    expect(hostMatch.match.you.attemptsTotal).toBe(3);

    const guestMatch = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    expect(guestMatch.statusCode).toBe(200);
    const guestBody = guestMatch.json() as {
      match: { currentRound: number; round: { panoId: string } | null };
    };
    expect(guestBody.match.currentRound).toBe(1);
    expect(guestBody.match.round?.panoId).toBe('test-pano-0');
  });

  it('removes a player from the lobby and scoreboard when they leave mid-match', async () => {
    const created = await createLobby('easy', 'Host');
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;

    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });

    const left = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/leave',
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    expect(left.statusCode).toBe(204);

    const hostView = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(hostView.statusCode).toBe(200);
    const body = hostView.json() as {
      lobby: { members: Array<{ displayName: string | null }> };
      match: {
        pendingPlayers: string[];
        leaderboard: Array<{ displayName: string | null }>;
      };
    };
    expect(body.lobby.members.map((member) => member.displayName)).toEqual([
      'Host',
    ]);
    expect(body.match.pendingPlayers).toEqual(['Host']);
    expect(
      body.match.leaderboard.map((entry) => entry.displayName),
    ).toEqual(['Host']);

    const guestView = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    expect(guestView.statusCode).toBe(404);
  });

  it('scores guesses per player and advances the shared round once everyone is done', async () => {
    const created = await createLobby('easy', 'Host');
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;

    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/rounds/1/guess',
      headers: { 'x-lobby-token': created.lobbyToken },
      payload: { lat: 51.5, lon: -0.12 },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as { finalized: boolean; attemptsRemaining: number };
    expect(firstBody.finalized).toBe(false);
    expect(firstBody.attemptsRemaining).toBe(2);
    expect(firstBody).not.toHaveProperty('result');

    const hostFinal = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/rounds/1/guess',
      headers: { 'x-lobby-token': created.lobbyToken },
      payload: { lat: 51.5, lon: -0.12, final: true },
    });
    expect(hostFinal.statusCode).toBe(200);
    const hostResult = hostFinal.json() as {
      finalized: boolean;
      result: { score: number; actual: { lat: number } };
    };
    expect(hostResult.finalized).toBe(true);
    expect(hostResult.result.actual.lat).toBeCloseTo(51.5009);

    const stillRoundOne = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    const waitingBody = stillRoundOne.json() as {
      match: {
        currentRound: number;
        roundComplete: boolean;
        pendingPlayers: string[];
        you: { finalized: boolean };
      };
    };
    expect(waitingBody.match.currentRound).toBe(1);
    expect(waitingBody.match.roundComplete).toBe(false);
    expect(waitingBody.match.pendingPlayers).toEqual(['Guest']);
    expect(waitingBody.match.you.finalized).toBe(true);

    const guestFinal = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/rounds/1/guess',
      headers: { 'x-lobby-token': guest.lobbyToken },
      payload: { lat: 48.85, lon: 2.35, final: true },
    });
    expect(guestFinal.statusCode).toBe(200);
    expect((guestFinal.json() as { finalized: boolean }).finalized).toBe(true);

    const advanced = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    const advancedBody = advanced.json() as {
      match: {
        currentRound: number;
        round: { panoId: string } | null;
        leaderboard: Array<{ displayName: string | null; totalScore: number; rank: number }>;
      };
    };
    expect(advancedBody.match.currentRound).toBe(2);
    expect(advancedBody.match.round?.panoId).toBe('test-pano-1');
    expect(advancedBody.match.leaderboard).toHaveLength(2);
    expect(advancedBody.match.leaderboard[0]?.rank).toBe(1);
    expect(new Set(advancedBody.match.leaderboard.map((entry) => entry.displayName))).toEqual(
      new Set(['Host', 'Guest']),
    );
  });


  it('unlocks additional data per player and deducts only that player (R05/R16)', async () => {
    const created = await createLobby('medium', 'Host', 3);
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;
    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });

    const unlock = await app.inject({
      method: 'POST',
      url: `/api/lobbies/${created.lobby.code}/rounds/1/unlock`,
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(unlock.statusCode).toBe(200);
    const hostAccess = (
      unlock.json() as {
        match: { round: { extraData: { unlocked: boolean; pointsSpent: number } } };
      }
    ).match.round.extraData;
    expect(hostAccess).toMatchObject({ unlocked: true, pointsSpent: 100 });

    const guestView = await app.inject({
      method: 'GET',
      url: `/api/lobbies/${created.lobby.code}/match`,
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    const guestAccess = (
      guestView.json() as {
        match: { round: { extraData: { unlocked: boolean; pointsSpent: number } } };
      }
    ).match.round.extraData;
    expect(guestAccess).toMatchObject({ unlocked: false, pointsSpent: 0 });

    const payload = { lat: 51.5, lon: -0.12, final: true };
    const hostFinal = await app.inject({
      method: 'POST',
      url: `/api/lobbies/${created.lobby.code}/rounds/1/guess`,
      headers: { 'x-lobby-token': created.lobbyToken },
      payload,
    });
    const hostResult = (
      hostFinal.json() as {
        result: { score: number; extraDataPointsSpent: number };
      }
    ).result;
    const guestFinal = await app.inject({
      method: 'POST',
      url: `/api/lobbies/${created.lobby.code}/rounds/1/guess`,
      headers: { 'x-lobby-token': guest.lobbyToken },
      payload,
    });
    const guestResult = (
      guestFinal.json() as {
        result: { score: number; extraDataPointsSpent: number };
      }
    ).result;

    expect(hostResult.extraDataPointsSpent).toBe(100);
    expect(guestResult.extraDataPointsSpent).toBe(0);
    expect(guestResult.score).toBe(hostResult.score + 100);
  });

  it('applies the hard-mode time penalty only to the player who unlocks (R05/R16)', async () => {
    const created = await createLobby('hard', 'Host', 3);
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;
    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });

    const endsAt = async (token: string) => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/lobbies/${created.lobby.code}/match`,
        headers: { 'x-lobby-token': token },
      });
      return (res.json() as { match: { endsAt: string } }).match.endsAt;
    };

    const hostBefore = await endsAt(created.lobbyToken);
    const guestBefore = await endsAt(guest.lobbyToken);
    expect(hostBefore).toBe(guestBefore);

    const unlock = await app.inject({
      method: 'POST',
      url: `/api/lobbies/${created.lobby.code}/rounds/1/unlock`,
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(unlock.statusCode).toBe(200);
    const hostAfter = (unlock.json() as { match: { endsAt: string } }).match.endsAt;
    const guestAfter = await endsAt(guest.lobbyToken);

    expect(guestAfter).toBe(guestBefore);
    expect(Date.parse(guestBefore) - Date.parse(hostAfter)).toBe(20_000);
  });

  it('returns the shared leaderboard ordered identically to every player', async () => {
    const created = await createLobby('easy', 'Host', 3);
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;
    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });

    const guess = (token: string, lat: number, lon: number) =>
      app.inject({
        method: 'POST',
        url: `/api/lobbies/${created.lobby.code}/rounds/1/guess`,
        headers: { 'x-lobby-token': token },
        payload: { lat, lon, final: true },
      });
    // Host guesses far from London, guest guesses the target exactly.
    await guess(created.lobbyToken, 0, 0);
    await guess(guest.lobbyToken, 51.5009, -0.1246);

    const leaderboard = async (token: string) => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/lobbies/${created.lobby.code}/match`,
        headers: { 'x-lobby-token': token },
      });
      return (
        res.json() as {
          match: {
            leaderboard: Array<{
              displayName: string | null;
              totalScore: number;
              rank: number;
            }>;
          };
        }
      ).match.leaderboard;
    };

    const hostBoard = await leaderboard(created.lobbyToken);
    const guestBoard = await leaderboard(guest.lobbyToken);

    expect(hostBoard.map((entry) => entry.displayName)).toEqual(['Guest', 'Host']);
    expect(hostBoard.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(hostBoard.map((entry) => entry.totalScore)).toEqual(
      guestBoard.map((entry) => entry.totalScore),
    );
    expect(hostBoard[0]!.totalScore).toBeGreaterThan(hostBoard[1]!.totalScore);
  });

  it('reveals every submitted participant guess and their easy-mode answer', async () => {
    const created = await createLobby('easy', 'Host');
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;

    const started = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    const startedBody = started.json() as {
      match: {
        round: {
          candidates: Array<{ name: string; lat: number; lon: number }>;
        };
      };
    };
    const [hostGuess, guestGuess] = startedBody.match.round.candidates;

    const hostFinal = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/rounds/1/guess',
      headers: { 'x-lobby-token': created.lobbyToken },
      payload: { lat: hostGuess!.lat, lon: hostGuess!.lon, final: true },
    });
    expect(hostFinal.statusCode).toBe(200);
    const hostBody = hostFinal.json() as {
      result: {
        guesses: Array<{
          displayName: string | null;
          isYou: boolean;
          answer: string | null;
          guess: { lat: number; lon: number } | null;
        }>;
      };
    };
    expect(hostBody.result.guesses).toHaveLength(1);
    expect(hostBody.result.guesses[0]).toMatchObject({
      displayName: 'Host',
      isYou: true,
      answer: hostGuess!.name,
      guess: { lat: hostGuess!.lat, lon: hostGuess!.lon },
    });

    const guestFinal = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/rounds/1/guess',
      headers: { 'x-lobby-token': guest.lobbyToken },
      payload: { lat: guestGuess!.lat, lon: guestGuess!.lon, final: true },
    });
    expect(guestFinal.statusCode).toBe(200);
    const guestBody = guestFinal.json() as typeof hostBody;
    expect(guestBody.result.guesses.map((entry) => entry.displayName)).toEqual([
      'Host',
      'Guest',
    ]);
    expect(guestBody.result.guesses.map((entry) => entry.answer)).toEqual([
      hostGuess!.name,
      guestGuess!.name,
    ]);
    expect(
      guestBody.result.guesses
        .filter((entry) => entry.isYou)
        .map((entry) => entry.displayName),
    ).toEqual(['Guest']);

    const advanced = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(advanced.statusCode).toBe(200);
    const advancedBody = advanced.json() as {
      match: {
        results: Array<{
          roundNumber: number;
          guesses: Array<{ displayName: string | null; answer: string | null }>;
        }>;
      };
    };
    expect(
      advancedBody.match.results[0]?.guesses.map((entry) => entry.displayName),
    ).toEqual(['Host', 'Guest']);
    expect(
      advancedBody.match.results[0]?.guesses.map((entry) => entry.answer),
    ).toEqual([hostGuess!.name, guestGuess!.name]);
  });

  it('locks in the latest selection when the round timer expires', async () => {
    const created = await createLobby('medium', 'Host');
    await joinLobby(created.lobby.code, 'Guest');
    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });

    const selection = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/selection',
      headers: { 'x-lobby-token': created.lobbyToken },
      payload: { lat: 51.5, lon: -0.12 },
    });
    expect(selection.statusCode).toBe(204);

    await prisma.lobbyRound.updateMany({
      where: { lobby: { code: created.lobby.code }, number: 1 },
      data: { endsAt: new Date(Date.now() - 1000) },
    });

    const expired = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(expired.statusCode).toBe(200);
    const body = expired.json() as {
      match: {
        currentRound: number;
        results: Array<{ roundNumber: number; guess: { lat: number } | null; score: number }>;
      };
    };
    expect(body.match.currentRound).toBe(2);
    expect(body.match.results[0]?.roundNumber).toBe(1);
    expect(body.match.results[0]?.guess?.lat).toBeCloseTo(51.5);
    expect(body.match.results[0]?.score).toBeGreaterThan(0);
  });

  it('prompts after the final round and starts a clean rematch when everyone continues', async () => {
    const created = await createLobby('easy', 'Host');
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;

    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    await finishMatch(created.lobby.code, [
      created.lobbyToken,
      guest.lobbyToken,
    ]);

    const finished = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(finished.statusCode).toBe(200);
    const finishedBody = finished.json() as {
      match: {
        status: string;
        results: Array<{ roundNumber: number }>;
        leaderboard: Array<{ totalScore: number }>;
        continuePrompt: {
          deadline: string;
          readyPlayers: string[];
          pendingPlayers: string[];
          youRequested: boolean;
        } | null;
      };
    };
    expect(finishedBody.match.status).toBe('finished');
    expect(finishedBody.match.results).toHaveLength(5);
    expect(finishedBody.match.continuePrompt).not.toBeNull();
    expect(finishedBody.match.continuePrompt?.pendingPlayers.sort()).toEqual([
      'Guest',
      'Host',
    ]);
    expect(finishedBody.match.continuePrompt?.readyPlayers).toEqual([]);
    expect(finishedBody.match.continuePrompt?.youRequested).toBe(false);

    const stored = await prisma.lobby.findUniqueOrThrow({
      where: { code: created.lobby.code },
    });
    expect(stored.finishedAt).not.toBeNull();
    expect(
      Date.parse(finishedBody.match.continuePrompt!.deadline) -
        stored.finishedAt!.getTime(),
    ).toBe(30_000);

    const hostContinue = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/continue',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(hostContinue.statusCode).toBe(200);
    const hostContinueBody = hostContinue.json() as typeof finishedBody;
    expect(hostContinueBody.match.status).toBe('finished');
    expect(hostContinueBody.match.continuePrompt?.youRequested).toBe(true);
    expect(hostContinueBody.match.continuePrompt?.readyPlayers).toEqual([
      'Host',
    ]);
    expect(hostContinueBody.match.continuePrompt?.pendingPlayers).toEqual([
      'Guest',
    ]);

    const guestContinue = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/continue',
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    expect(guestContinue.statusCode).toBe(200);
    const rematch = guestContinue.json() as {
      lobby: { difficulty: string; roundsTotal: number; members: unknown[] };
      match: {
        status: string;
        currentRound: number;
        results: unknown[];
        continuePrompt: unknown;
        leaderboard: Array<{ totalScore: number; roundsCompleted: number }>;
      };
    };
    expect(rematch.match.status).toBe('playing');
    expect(rematch.match.currentRound).toBe(1);
    expect(rematch.match.results).toEqual([]);
    expect(rematch.match.continuePrompt).toBeNull();
    expect(rematch.match.leaderboard).toHaveLength(2);
    expect(
      rematch.match.leaderboard.every(
        (entry) => entry.totalScore === 0 && entry.roundsCompleted === 0,
      ),
    ).toBe(true);
    expect(rematch.lobby).toMatchObject({
      difficulty: 'easy',
      roundsTotal: 5,
    });
    expect(rematch.lobby.members).toHaveLength(2);
  });

  it('removes silent players after 30 seconds and restarts with the ones who continue', async () => {
    const created = await createLobby('easy', 'Host');
    const joinedGuest = await joinLobby(created.lobby.code, 'Guest');
    const guest = joinedGuest.json() as LobbyBody;
    const joinedThird = await joinLobby(created.lobby.code, 'Third');
    const third = joinedThird.json() as LobbyBody;
    const tokens = [created.lobbyToken, guest.lobbyToken, third.lobbyToken];

    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    await finishMatch(created.lobby.code, tokens);

    for (const token of [created.lobbyToken, third.lobbyToken]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/lobbies/' + created.lobby.code + '/continue',
        headers: { 'x-lobby-token': token },
      });
      expect(res.statusCode).toBe(200);
    }

    // Simulate the decision window having elapsed without an answer from Guest.
    await prisma.lobby.update({
      where: { code: created.lobby.code },
      data: { finishedAt: new Date(Date.now() - 31_000) },
    });

    const hostView = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(hostView.statusCode).toBe(200);
    const hostBody = hostView.json() as {
      lobby: { members: Array<{ displayName: string | null }> };
      match: {
        status: string;
        currentRound: number;
        results: unknown[];
        leaderboard: Array<{ displayName: string | null; totalScore: number }>;
      };
    };
    expect(hostBody.match.status).toBe('playing');
    expect(hostBody.match.currentRound).toBe(1);
    expect(hostBody.match.results).toEqual([]);
    expect(hostBody.lobby.members.map((entry) => entry.displayName).sort()).toEqual([
      'Host',
      'Third',
    ]);
    expect(hostBody.match.leaderboard.map((entry) => entry.totalScore)).toEqual([
      0,
      0,
    ]);

    const guestView = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    expect(guestView.statusCode).toBe(404);
  });

  it('archives authenticated multiplayer results but not guest results (R18)', async () => {
    const account = await signIn('Lobby Archive Host');
    const created = await createLobby('hard', 'Archive Host', 3, account.cookie);
    const guestResponse = await joinLobby(created.lobby.code, 'Archive Guest');
    expect(guestResponse.statusCode).toBe(201);
    const guest = guestResponse.json() as LobbyBody;

    const start = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    expect(start.statusCode).toBe(200);

    await finishRound(created.lobby.code, 1, created.lobbyToken);
    await finishRound(created.lobby.code, 1, guest.lobbyToken);
    // Resolve the finished round/lobby so any deferred finalization runs.
    await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });

    const lobbyRow = await prisma.lobby.findUniqueOrThrow({
      where: { code: created.lobby.code },
    });
    const archived = await prisma.gameResult.findFirstOrThrow({
      where: {
        sessionId: created.lobby.lobbyId,
        userId: account.user.id,
      },
    });
    expect(archived.mode).toBe('multiplayer');
    expect(archived.difficulty).toBe('hard');
    expect(archived.matchId).toBe(lobbyRow.matchId);
    expect(archived.roundNumber).toBe(1);
    expect(archived.actualLat).toBe(MATCH_TARGETS[0]!.lat);
    expect(archived.actualLon).toBe(MATCH_TARGETS[0]!.lon);
    expect(archived.guessLat).toBe(51.5);
    expect(archived.guessLon).toBe(-0.12);
    // The guest member has no account, so nothing is archived for them.
    expect(
      await prisma.gameResult.count({
        where: { sessionId: created.lobby.lobbyId, userId: null },
      }),
    ).toBe(0);
  });

  it('rotates matchId on a rematch while keeping the same sessionId (R18)', async () => {
    const account = await signIn('Lobby Rematch Host');
    const created = await createLobby('easy', 'Rematch Host', 3, account.cookie);
    const guestResponse = await joinLobby(created.lobby.code, 'Rematch Guest');
    const guest = guestResponse.json() as LobbyBody;
    const tokens = [created.lobbyToken, guest.lobbyToken];

    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    await finishMatch(created.lobby.code, tokens, 3);

    const firstMatch = await prisma.lobby.findUniqueOrThrow({
      where: { code: created.lobby.code },
    });
    const firstMatchId = firstMatch.matchId;

    for (const token of tokens) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/lobbies/' + created.lobby.code + '/continue',
        headers: { 'x-lobby-token': token },
      });
      expect(response.statusCode).toBe(200);
    }

    const secondMatch = await prisma.lobby.findUniqueOrThrow({
      where: { code: created.lobby.code },
    });
    expect(secondMatch.matchId).not.toBe(firstMatchId);

    await finishRound(created.lobby.code, 1, created.lobbyToken);
    await finishRound(created.lobby.code, 1, guest.lobbyToken);
    await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': created.lobbyToken },
    });

    const archived = await prisma.gameResult.findMany({
      where: {
        userId: account.user.id,
        sessionId: firstMatch.id,
      },
    });
    expect(archived).toHaveLength(4);
    expect(new Set(archived.map((row) => row.matchId))).toEqual(
      new Set([firstMatchId, secondMatch.matchId]),
    );
  });
});
