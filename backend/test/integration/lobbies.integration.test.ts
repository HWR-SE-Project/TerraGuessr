import './helpers/env.js'; // first: sets DATABASE_URL before any db/prisma import
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
import { registerResultsRoutes } from '../../src/modules/results/routes.js';
import { LOBBY_ROUND_REVIEW_MS } from '../../src/config/constants.js';
import type { LobbyMatchResponse } from '../../src/contracts/lobbies.js';

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
    modelTime: new Date().toISOString(),
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

/** Lobby lifecycle and membership rules. */
describe('lobby lifecycle (integration)', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let expiredWeatherLatitude: number | undefined;
  let panoramaLatitudeOffset = 0;
  const createdCodes: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    prisma = await setupDatabase();
    app = buildTestApp(prisma, {
      provider: matchProvider,
      locate: async (panoId) => {
        const target = MATCH_TARGETS[Number(panoId.slice('test-pano-'.length))]!;
        return { lat: target.lat + panoramaLatitudeOffset, lon: target.lon };
      },
      intelligence: async (lat, lon) => {
        const data = await matchIntelligence(lat, lon);
        if (lat === expiredWeatherLatitude && data.weather) {
          data.weather.modelTime = '2000-01-01T00:00:00Z';
        }
        return data;
      },
    });
    registerResultsRoutes(app, prisma);
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

  async function joinLobby(code: string, displayName = 'Guest', cookie?: string) {
    return app.inject({
      method: 'POST',
      url: '/api/lobbies/' + code + '/join',
      headers: cookie ? { cookie } : undefined,
      payload: { displayName },
    });
  }

  async function finishRound(
    code: string,
    roundNumber: number,
    token: string,
  ): Promise<void> {
    const match = await readMatch(code, token);
    const firstCandidate = match.round?.candidates?.[0];
    const payload = firstCandidate
      ? { candidateId: firstCandidate.id, final: true }
      : { lat: 51.5, lon: -0.12, final: true };
    const res = await app.inject({
      method: 'POST',
      url: `/api/lobbies/${code}/rounds/${roundNumber}/guess`,
      headers: { 'x-lobby-token': token },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { finalized: boolean }).finalized).toBe(true);
  }

  async function readMatch(code: string, token: string): Promise<LobbyMatchResponse['match']> {
    const response = await app.inject({
      url: `/api/lobbies/${code}/match`,
      headers: { 'x-lobby-token': token },
    });
    expect(response.statusCode).toBe(200);
    return response.json<LobbyMatchResponse>().match;
  }

  async function expireReview(code: string, roundNumber: number): Promise<void> {
    const changed = await prisma.lobbyRound.updateMany({
      where: { lobby: { code }, number: roundNumber, reviewEndsAt: { not: null } },
      data: { reviewEndsAt: new Date(Date.now() - 1) },
    });
    expect(changed.count).toBe(1);
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
      const review = await readMatch(code, tokens[0]!);
      expect(review).toMatchObject({ status: 'playing', currentRound: round, reviewEndsAt: expect.any(String) });
      await expireReview(code, round);
      await readMatch(code, tokens[0]!);
    }
  }

  it('creates a lobby with the host, a 6-character code, and difficulty rules', async () => {
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
        round: { number: number; scene: { biome: string; seed: number }; candidates?: unknown[] } | null;
        you: { attemptsTotal: number; finalized: boolean };
      };
    };
    expect(hostMatch.match.status).toBe('playing');
    expect(hostMatch.match.currentRound).toBe(1);
    expect(hostMatch.match.round?.number).toBe(1);
    expect(hostMatch.match.round).not.toHaveProperty('panoId');
    expect(hostMatch.match.round?.scene.seed).toEqual(expect.any(Number));
    expect(hostMatch.match.round?.candidates).toHaveLength(6);
    expect(hostMatch.match.you.attemptsTotal).toBe(3);

    const guestMatch = await app.inject({
      method: 'GET',
      url: '/api/lobbies/' + created.lobby.code + '/match',
      headers: { 'x-lobby-token': guest.lobbyToken },
    });
    expect(guestMatch.statusCode).toBe(200);
    const guestBody = guestMatch.json() as {
      match: { currentRound: number; round: { scene: { biome: string; seed: number } } | null };
    };
    expect(guestBody.match.currentRound).toBe(1);
    expect(guestBody.match.round?.scene).toEqual(hostMatch.match.round?.scene);
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

  it('shares a twenty-second review and starts the next round with its full clock', async () => {
    const host = await createLobby('easy', 'Host');
    const guest = (await joinLobby(host.lobby.code, 'Guest')).json() as LobbyBody;
    const code = host.lobby.code;
    const base = `/api/lobbies/${code}`;
    const submit = (token: string, candidateId: string, final = true, roundNumber = 1) =>
      app.inject({
        method: 'POST', url: `${base}/rounds/${roundNumber}/guess`,
        headers: { 'x-lobby-token': token },
        payload: { candidateId, final },
      });

    const started = await app.inject({ method: 'POST', url: `${base}/start`, headers: { 'x-lobby-token': host.lobbyToken } });
    const roundCandidates = (started.json() as LobbyMatchResponse).match.round!.candidates!;
    const london = roundCandidates.find((c) => c.name === 'London')!;
    const distractor = roundCandidates.find((c) => c.name !== 'London')!;
    const first = await submit(host.lobbyToken, london.id, false);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ finalized: false, attemptsRemaining: 2, attemptsUsed: 1 });

    const earlyFinal = await submit(host.lobbyToken, london.id);
    expect(earlyFinal.statusCode).toBe(200);
    expect(earlyFinal.json()).toEqual({ finalized: true, attemptsRemaining: 0, attemptsUsed: 2 });
    const waiting = await readMatch(code, host.lobbyToken);
    expect(waiting).toMatchObject({
      currentRound: 1, roundComplete: false, reviewEndsAt: null, pendingPlayers: ['Guest'],
      you: { finalized: true, result: null }, results: [],
    });
    expect(waiting.leaderboard.every((entry) => entry.totalScore === 0)).toBe(true);

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const closedAt = Date.now();
      const last = await submit(guest.lobbyToken, distractor.id);
      expect(last.statusCode).toBe(200);

      const [hostReview, guestReview] = await Promise.all([
        readMatch(code, host.lobbyToken), readMatch(code, guest.lobbyToken),
      ]);
      const reviewEndsAt = new Date(closedAt + LOBBY_ROUND_REVIEW_MS).toISOString();
      for (const match of [hostReview, guestReview]) {
        expect(match).toMatchObject({
          status: 'playing', currentRound: 1, roundComplete: true, reviewEndsAt, endsAt: null,
          you: { finalized: true, result: { actual: MATCH_TARGETS[0] } },
        });
        expect(match.you.result?.guesses.map((guess) => guess.displayName)).toEqual(['Host', 'Guest']);
        expect(match.leaderboard.map((entry) => entry.displayName)).toEqual(['Host', 'Guest']);
      }
      const premature = await submit(guest.lobbyToken, distractor.id, true, 2);
      expect(premature.statusCode).toBe(409);

      await vi.waitFor(async () => {
        const planned = await prisma.lobbyRound.findFirstOrThrow({
          where: { lobby: { code }, number: 2 },
        });
        expect(planned.weatherValidUntil).toBeInstanceOf(Date);
        expect(planned.startedAt).toBeNull();
        expect(planned.endsAt).toBeNull();
      });

      vi.setSystemTime(closedAt + LOBBY_ROUND_REVIEW_MS - 1);
      expect(await readMatch(code, guest.lobbyToken)).toMatchObject({ currentRound: 1, reviewEndsAt });

      vi.setSystemTime(closedAt + LOBBY_ROUND_REVIEW_MS);
      const [hostNext, guestNext] = await Promise.all([
        readMatch(code, host.lobbyToken), readMatch(code, guest.lobbyToken),
      ]);
      for (const next of [hostNext, guestNext]) {
        expect(next).toMatchObject({
          currentRound: 2, reviewEndsAt: null, roundComplete: false, startedAt: reviewEndsAt,
          round: { scene: expect.objectContaining({ biome: expect.any(String), seed: expect.any(Number) }) },
          you: { attemptsUsed: 0, selection: null },
        });
        expect(next.round).toEqual(hostNext.round);
        expect(Date.parse(next.endsAt!) - Date.parse(next.startedAt!))
          .toBe(next.rules.timeLimitSeconds * 1000);
        expect(next.results.map((result) => result.roundNumber)).toEqual([1]);
      }
    } finally {
      vi.useRealTimers();
    }
  });


  it('replaces a planned target whose weather expires before the lobby round starts', async () => {
    const host = await createLobby('easy', 'Host', 3);
    const guest = (await joinLobby(host.lobby.code, 'Guest')).json() as LobbyBody;
    const base = `/api/lobbies/${host.lobby.code}`;
    const started = await app.inject({
      method: 'POST', url: `${base}/start`, headers: { 'x-lobby-token': host.lobbyToken },
    });
    expect(started.statusCode).toBe(200);
    const firstChoice = (started.json() as LobbyMatchResponse).match.round!.candidates![0]!;
    expiredWeatherLatitude = MATCH_TARGETS[1].lat;
    try {
      for (const player of [host, guest]) {
        const guess = await app.inject({
          method: 'POST', url: `${base}/rounds/1/guess`, headers: { 'x-lobby-token': player.lobbyToken },
          payload: { candidateId: firstChoice.id, final: true },
        });
        expect(guess.statusCode).toBe(200);
        expect(guess.json().finalized).toBe(true);
      }
      await vi.waitFor(async () => {
        const next = await prisma.lobbyRound.findFirstOrThrow({ where: { lobby: { code: host.lobby.code }, number: 2 } });
        expect(next).toMatchObject({ panoId: 'test-pano-3', startedAt: null });
      });
      await expireReview(host.lobby.code, 1);
      for (const player of [host, guest]) {
        const headers = { 'x-lobby-token': player.lobbyToken };
        const state = await app.inject({ url: `${base}/match`, headers });
        expect(state.json().match.round).toMatchObject({
          number: 2,
          scene: expect.objectContaining({ biome: expect.any(String) }),
        });
        const clues = await app.inject({ url: `${base}/rounds/2/intelligence`, headers });
        expect(clues.json().weather).toMatchObject({ temperatureC: 18 });
      }
    } finally {
      expiredWeatherLatitude = undefined;
    }
  });

  it('unlocks additional data per player and deducts points only from that player', async () => {
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

    const hostClues = (
      await app.inject({
        url: `/api/lobbies/${created.lobby.code}/rounds/1/intelligence`,
        headers: { 'x-lobby-token': created.lobbyToken },
      })
    ).json();
    const guestClues = (
      await app.inject({
        url: `/api/lobbies/${created.lobby.code}/rounds/1/intelligence`,
        headers: { 'x-lobby-token': guest.lobbyToken },
      })
    ).json();
    expect(hostClues.weather).toMatchObject({ condition: 'Clear sky', pressureHpa: 1012 });
    expect(hostClues.environment).toMatchObject({ elevationM: 20, reliefM: 5, terrain: 'Low relief' });
    expect(guestClues.weather).toMatchObject({ temperatureC: 18, condition: null, pressureHpa: null });
    expect(guestClues.environment).toMatchObject({ elevationM: null, reliefM: null, terrain: null });

    const payload = { lat: 51.5, lon: -0.12, final: true };
    const hostFinal = await app.inject({
      method: 'POST',
      url: `/api/lobbies/${created.lobby.code}/rounds/1/guess`,
      headers: { 'x-lobby-token': created.lobbyToken },
      payload,
    });
    expect(hostFinal.statusCode).toBe(200);
    const guestFinal = await app.inject({
      method: 'POST',
      url: `/api/lobbies/${created.lobby.code}/rounds/1/guess`,
      headers: { 'x-lobby-token': guest.lobbyToken },
      payload,
    });
    expect(guestFinal.statusCode).toBe(200);
    const hostResult = (await readMatch(created.lobby.code, created.lobbyToken)).you.result!;
    const guestResult = (await readMatch(created.lobby.code, guest.lobbyToken)).you.result!;

    expect(hostResult.extraDataPointsSpent).toBe(100);
    expect(guestResult.extraDataPointsSpent).toBe(0);
    expect(guestResult.score).toBe(hostResult.score + 100);
  });

  it('applies the hard-mode time penalty only to the player who unlocks', async () => {
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
    const created = await createLobby('medium', 'Host', 3);
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

  it('reveals every submitted participant guess and their easy-mode answer without leaking coordinates beforehand', async () => {
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
          candidates: Array<{ id: string; name: string; region: string; lat: number; lon: number }>;
        };
      };
    };
    expect(startedBody.match.round.candidates).toHaveLength(6);
    for (const candidate of startedBody.match.round.candidates) {
      expect(Object.keys(candidate).sort()).toEqual(['id', 'lat', 'lon', 'name', 'region']);
    }
    const [hostGuess, guestGuess] = startedBody.match.round.candidates;

    // Easy mode rejects raw coordinates and forged candidate IDs.
    const rawGuess = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/rounds/1/guess',
      headers: { 'x-lobby-token': created.lobbyToken },
      payload: { lat: 51.5, lon: -0.12, final: true },
    });
    expect(rawGuess.statusCode).toBe(400);
    const forgedSelection = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/selection',
      headers: { 'x-lobby-token': created.lobbyToken },
      payload: { candidateId: 'not-in-round' },
    });
    expect(forgedSelection.statusCode).toBe(400);

    const savedSelection = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/selection',
      headers: { 'x-lobby-token': created.lobbyToken },
      payload: { candidateId: hostGuess!.id },
    });
    expect(savedSelection.statusCode).toBe(204);
    const withSelection = await readMatch(created.lobby.code, created.lobbyToken);
    expect(withSelection.you.selection).toBeNull();
    expect(withSelection.you.selectedCandidateId).toBe(hostGuess!.id);

    const hostFinal = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/rounds/1/guess',
      headers: { 'x-lobby-token': created.lobbyToken },
      payload: { candidateId: hostGuess!.id, final: true },
    });
    expect(hostFinal.statusCode).toBe(200);
    expect(hostFinal.json()).not.toHaveProperty('result');
    expect((await readMatch(created.lobby.code, created.lobbyToken)).you.result).toBeNull();

    const guestFinal = await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/rounds/1/guess',
      headers: { 'x-lobby-token': guest.lobbyToken },
      payload: { candidateId: guestGuess!.id, final: true },
    });
    expect(guestFinal.statusCode).toBe(200);
    const hostReview = await readMatch(created.lobby.code, created.lobbyToken);
    const guestReview = await readMatch(created.lobby.code, guest.lobbyToken);
    for (const [review, viewer] of [[hostReview, 'Host'], [guestReview, 'Guest']] as const) {
      const guesses = review.you.result?.guesses ?? [];
      expect(guesses.map((guess) => guess.displayName)).toEqual(['Host', 'Guest']);
      expect(guesses.map((guess) => guess.answer)).toEqual([hostGuess!.name, guestGuess!.name]);
      expect(guesses.find((guess) => guess.isYou)?.displayName).toBe(viewer);
    }
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
    expect(body.match.currentRound).toBe(1);
    expect(body.match.results[0]?.roundNumber).toBe(1);
    expect(body.match.results[0]?.guess?.lat).toBeCloseTo(51.5);
    expect(body.match.results[0]?.score).toBeGreaterThan(0);
  });

  it('uses the exact panorama to score the last attempt on timeout and rejects stale round selections', async () => {
    panoramaLatitudeOffset = 0.0002;
    try {
      const host = await createLobby('medium', 'Host', 3);
      await joinLobby(host.lobby.code, 'Guest');
      const base = `/api/lobbies/${host.lobby.code}`;
      const headers = { 'x-lobby-token': host.lobbyToken };
      const started = await app.inject({ method: 'POST', url: `${base}/start`, headers });
      const oldRoundId = started.json().match.round.id;
      const actual = { ...MATCH_TARGETS[0], lat: MATCH_TARGETS[0].lat + panoramaLatitudeOffset };
      const last = { lat: -20, lon: -60 };
      const firstResponse = await app.inject({ method: 'POST', url: `${base}/rounds/1/guess`, headers, payload: actual });
      expect(firstResponse.json().finalized).toBe(false);
      await app.inject({ method: 'POST', url: `${base}/selection`, headers, payload: last });
      await prisma.lobbyRound.update({ where: { id: oldRoundId }, data: { endsAt: new Date(Date.now() - 1000) } });
      const review = await readMatch(host.lobby.code, host.lobbyToken);
      expect(review.currentRound).toBe(1);
      expect(review.results[0]).toMatchObject({ guess: actual, actual, distanceKm: 0 });
      expect(review.results[0]?.attempts).toHaveLength(1);
      expect(review.results[0]?.attempts[0]).toMatchObject({ attemptNumber: 1, guess: actual, isBest: true });
      expect(review.results[0]?.guesses.find((guess) => !guess.isYou)).toMatchObject({ guess: null, score: 0 });
      await expireReview(host.lobby.code, 1);
      expect((await readMatch(host.lobby.code, host.lobbyToken)).currentRound).toBe(2);
      const stale = await app.inject({ method: 'POST', url: `${base}/selection`, headers, payload: { ...last, roundId: oldRoundId } });
      expect(stale.statusCode).toBe(409);
    } finally {
      panoramaLatitudeOffset = 0;
    }
  });

  it('keeps final standings visible past 30 seconds when nobody requests a rematch', async () => {
    const created = await createLobby('easy', 'Host', 3);
    const joined = await joinLobby(created.lobby.code, 'Guest');
    const guest = joined.json() as LobbyBody;

    await app.inject({
      method: 'POST',
      url: '/api/lobbies/' + created.lobby.code + '/start',
      headers: { 'x-lobby-token': created.lobbyToken },
    });
    await finishMatch(created.lobby.code, [created.lobbyToken, guest.lobbyToken], 3);

    // Simulate 5 minutes passing with everyone simply reading the final standings.
    await prisma.lobby.update({
      where: { code: created.lobby.code },
      data: { finishedAt: new Date(Date.now() - 5 * 60_000) },
    });

    for (const token of [created.lobbyToken, guest.lobbyToken]) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/lobbies/' + created.lobby.code + '/match',
        headers: { 'x-lobby-token': token },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json<LobbyMatchResponse>();
      expect(body.match.status).toBe('finished');
      expect(body.match.leaderboard).toHaveLength(2);
      expect(body.match.results).toHaveLength(3);
      expect(body.match.continuePrompt).toMatchObject({
        deadline: null,
        readyPlayers: [],
        youRequested: false,
      });
    }
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
          deadline: string | null;
          readyPlayers: string[];
          pendingPlayers: string[];
          youRequested: boolean;
        } | null;
      };
    };
    expect(finishedBody.match.status).toBe('finished');
    expect(finishedBody.match.results).toHaveLength(5);
    expect(finishedBody.match.continuePrompt).not.toBeNull();
    expect(finishedBody.match.continuePrompt?.deadline).toBeNull();
    expect(finishedBody.match.continuePrompt?.pendingPlayers.sort()).toEqual([
      'Guest',
      'Host',
    ]);
    expect(finishedBody.match.continuePrompt?.readyPlayers).toEqual([]);
    expect(finishedBody.match.continuePrompt?.youRequested).toBe(false);

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
    const hostMember = await prisma.lobbyMember.findFirstOrThrow({
      where: { lobby: { code: created.lobby.code }, displayName: 'Host' },
    });
    expect(hostMember.continueRequestedAt).not.toBeNull();
    expect(
      Date.parse(hostContinueBody.match.continuePrompt!.deadline!) -
        hostMember.continueRequestedAt!.getTime(),
    ).toBe(30_000);

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

  it('removes silent players 30 seconds after a rematch is requested and restarts with the ones who continue', async () => {
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

    // Simulate 30 seconds elapsing since the rematch was requested without an answer from Guest.
    await prisma.lobbyMember.updateMany({
      where: { lobby: { code: created.lobby.code }, continueRequestedAt: { not: null } },
      data: { continueRequestedAt: new Date(Date.now() - 31_000) },
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

  it('archives authenticated multiplayer results but not guest results', async () => {
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

  it('withholds multiplayer target and score from account history until shared review opens', async () => {
    const hostAccount = await signIn('Early Finish Host');
    const guestAccount = await signIn('Late Finish Guest');
    const host = await createLobby('medium', 'Early Host', 3, hostAccount.cookie);
    const guestResponse = await joinLobby(host.lobby.code, 'Late Guest', guestAccount.cookie);
    expect(guestResponse.statusCode).toBe(201);
    const guest = guestResponse.json() as LobbyBody;

    const start = await app.inject({
      method: 'POST',
      url: `/api/lobbies/${host.lobby.code}/start`,
      headers: { 'x-lobby-token': host.lobbyToken },
    });
    expect(start.statusCode).toBe(200);

    // Host finishes round 1 while Guest is still playing.
    await finishRound(host.lobby.code, 1, host.lobbyToken);

    const waitingMatch = await readMatch(host.lobby.code, host.lobbyToken);
    expect(waitingMatch).toMatchObject({
      roundComplete: false,
      reviewEndsAt: null,
      you: { finalized: true, result: null },
      results: [],
    });

    const earlyHistory = await app.inject({
      url: '/api/me/results',
      headers: { cookie: hostAccount.cookie },
    });
    expect(earlyHistory.statusCode).toBe(200);
    expect(earlyHistory.json()).toMatchObject({ matches: [], total: 0 });
    expect(
      await prisma.gameResult.count({ where: { sessionId: host.lobby.lobbyId } }),
    ).toBe(0);

    // Once Guest finishes, shared review opens and both accounts receive archived results.
    await finishRound(host.lobby.code, 1, guest.lobbyToken);

    const revealedMatch = await readMatch(host.lobby.code, host.lobbyToken);
    expect(revealedMatch.roundComplete).toBe(true);
    expect(revealedMatch.you.result?.actual).toEqual(MATCH_TARGETS[0]);

    for (const account of [hostAccount, guestAccount]) {
      const history = await app.inject({
        url: '/api/me/results',
        headers: { cookie: account.cookie },
      });
      expect(history.statusCode).toBe(200);
      const body = history.json() as {
        total: number;
        matches: Array<{
          sessionId: string;
          results: Array<{ roundNumber: number; actual: { lat: number; lon: number } }>;
        }>;
      };
      expect(body.total).toBe(1);
      expect(body.matches[0]?.sessionId).toBe(host.lobby.lobbyId);
      expect(body.matches[0]?.results).toHaveLength(1);
      expect(body.matches[0]?.results[0]?.actual).toEqual(MATCH_TARGETS[0]);
    }
  });

  it('scores, reveals, and archives the closest attempt (Best-of-N) across Final Submit and timeout in multiplayer', async () => {
    const hostAccount = await signIn('Lobby Best Host');
    const guestAccount = await signIn('Lobby Best Guest');
    const host = await createLobby('medium', 'Best Host', 3, hostAccount.cookie);
    const guest = (await joinLobby(host.lobby.code, 'Best Guest', guestAccount.cookie)).json() as LobbyBody;
    const base = `/api/lobbies/${host.lobby.code}`;

    await app.inject({ method: 'POST', url: `${base}/start`, headers: { 'x-lobby-token': host.lobbyToken } });

    // Host places a closer first bet, then explicitly finalizes a much farther second bet.
    const hostClose = MATCH_TARGETS[0];
    const hostFar = { lat: -33.8688, lon: 151.2093 };
    const h1 = await app.inject({
      method: 'POST', url: `${base}/rounds/1/guess`,
      headers: { 'x-lobby-token': host.lobbyToken },
      payload: hostClose,
    });
    expect(h1.json()).toMatchObject({ finalized: false, attemptsRemaining: 1 });
    expect((await readMatch(host.lobby.code, host.lobbyToken)).you.submittedGuesses).toEqual([hostClose]);

    const h2 = await app.inject({
      method: 'POST', url: `${base}/rounds/1/guess`,
      headers: { 'x-lobby-token': host.lobbyToken },
      payload: { ...hostFar, final: true },
    });
    expect(h2.json()).toMatchObject({ finalized: true, attemptsUsed: 2 });

    // Guest places a close first bet, moves selection far away, then times out.
    const guestClose = { lat: 51.5, lon: -0.1 };
    const g1 = await app.inject({
      method: 'POST', url: `${base}/rounds/1/guess`,
      headers: { 'x-lobby-token': guest.lobbyToken },
      payload: guestClose,
    });
    expect(g1.json()).toMatchObject({ finalized: false, attemptsRemaining: 1 });
    await app.inject({
      method: 'POST', url: `${base}/selection`,
      headers: { 'x-lobby-token': guest.lobbyToken },
      payload: { lat: 0, lon: 0 },
    });
    await prisma.lobbyRound.updateMany({
      where: { lobby: { code: host.lobby.code }, number: 1 },
      data: { endsAt: new Date(Date.now() - 1000) },
    });

    const hostReview = await readMatch(host.lobby.code, host.lobbyToken);
    expect(hostReview.you.result).toMatchObject({ guess: hostClose, score: 5000 });
    expect(hostReview.you.result?.attempts).toHaveLength(2);
    expect(hostReview.you.result?.attempts[0]).toMatchObject({ attemptNumber: 1, guess: hostClose, isBest: true });
    expect(hostReview.you.result?.attempts[1]).toMatchObject({ attemptNumber: 2, guess: hostFar, isBest: false });

    const guestReview = await readMatch(host.lobby.code, guest.lobbyToken);
    expect(guestReview.you.result).toMatchObject({ guess: guestClose, score: 5000 });

    const hostArchived = await prisma.gameResult.findFirstOrThrow({
      where: { sessionId: host.lobby.lobbyId, userId: hostAccount.user.id },
    });
    expect(hostArchived).toMatchObject({
      guessLat: hostClose.lat,
      guessLon: hostClose.lon,
      score: 5000,
    });
  });

  it('caps weather retrieval at 3 distinct locations per lobby round across planning, review prep, and repeated polls', async () => {
    const fetchedForRound: string[] = [];
    let failAllWeather = false;
    const budgetApp = buildTestApp(prisma, {
      provider: matchProvider,
      intelligence: async (lat, lon) => {
        fetchedForRound.push(`${lat},${lon}`);
        const data = await matchIntelligence(lat, lon);
        if (failAllWeather) data.weather = null;
        return data;
      },
    });
    try {
      const createRes = await budgetApp.inject({
        method: 'POST',
        url: '/api/lobbies',
        payload: { difficulty: 'medium', displayName: 'Budget Host', roundsTotal: 3 },
      });
      const host = createRes.json() as LobbyBody;
      createdCodes.push(host.lobby.code);
      const guest = (
        await budgetApp.inject({
          method: 'POST',
          url: `/api/lobbies/${host.lobby.code}/join`,
          payload: { displayName: 'Budget Guest' },
        })
      ).json() as LobbyBody;

      const base = `/api/lobbies/${host.lobby.code}`;
      const started = await budgetApp.inject({
        method: 'POST',
        url: `${base}/start`,
        headers: { 'x-lobby-token': host.lobbyToken },
      });
      expect(started.statusCode).toBe(200);
      // Match start validates ONLY Round 1 once (1 distinct coordinate, never 6).
      expect(new Set(fetchedForRound).size).toBe(1);

      // Now fail weather for all Round 2 candidates; finish Round 1 so review prep runs.
      fetchedForRound.length = 0;
      failAllWeather = true;
      for (const token of [host.lobbyToken, guest.lobbyToken]) {
        const res = await budgetApp.inject({
          method: 'POST',
          url: `${base}/rounds/1/guess`,
          headers: { 'x-lobby-token': token },
          payload: { lat: 51.5, lon: -0.12, final: true },
        });
        expect(res.statusCode).toBe(200);
      }
      await vi.waitFor(async () => {
        const r2 = await prisma.lobbyRound.findFirstOrThrow({
          where: { lobby: { code: host.lobby.code }, number: 2 },
        });
        expect(r2.weatherExhausted).toBe(true);
      });
      expect(new Set(fetchedForRound).size).toBe(3);

      // Expire review and poll 3 times: must return 503 with ZERO extra coordinates fetched.
      await expireReview(host.lobby.code, 1);
      for (let i = 0; i < 3; i++) {
        const poll = await budgetApp.inject({
          url: `${base}/match`,
          headers: { 'x-lobby-token': host.lobbyToken },
        });
        expect(poll.statusCode).toBe(503);
        expect(poll.json().error.code).toBe('WEATHER_UNAVAILABLE');
      }
      expect(new Set(fetchedForRound).size).toBe(3);
    } finally {
      await budgetApp.close();
    }
  });

  it('preserves placeName on pre-diorama legacy lobby rounds (index 2 Rome) instead of showing Berlin', async () => {
    const host = await createLobby('medium', 'Legacy Host', 3);
    const guest = (await joinLobby(host.lobby.code, 'Legacy Guest')).json() as LobbyBody;
    const lobby = await prisma.lobby.findUniqueOrThrow({
      where: { code: host.lobby.code },
      include: { members: true },
    });
    await prisma.lobby.update({
      where: { id: lobby.id },
      data: { status: 'finished', currentRound: 1, startedAt: new Date(), finishedAt: new Date() },
    });
    const round = await prisma.lobbyRound.create({
      data: {
        lobbyId: lobby.id,
        number: 1,
        panoId: 'legacy-lobby-rome',
        targetIndex: 2, // Pre-diorama index 2 = Rome; current index 2 = Berlin
        targetLat: 41.8902,
        targetLon: 12.4923,
        placeName: null,
        reviewEndsAt: new Date(Date.now() - 1000),
      },
    });
    for (const member of lobby.members) {
      await prisma.lobbyRoundResult.create({
        data: {
          roundId: round.id,
          memberId: member.id,
          actualLat: 41.8902,
          actualLon: 12.4923,
          guessLat: 41.9,
          guessLon: 12.5,
          distanceKm: 1.2,
          score: 5000,
          attemptsUsed: 1,
        },
      });
    }

    const match = await readMatch(host.lobby.code, guest.lobbyToken);
    expect(match.results).toHaveLength(1);
    expect(match.results[0]).toMatchObject({
      actual: { lat: 41.8902, lon: 12.4923 },
      placeName: 'Rome',
    });
  });

  it('rotates matchId on a rematch while keeping the same sessionId', async () => {
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
