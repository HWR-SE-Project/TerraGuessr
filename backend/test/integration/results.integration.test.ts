import './helpers/env.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { registerResultsRoutes } from '../../src/modules/results/routes.js';
import { registerStatisticsRoutes } from '../../src/modules/statistics/routes.js';
import { createUserSession } from '../../src/modules/auth/service.js';
import {
  purgeExpiredGameResults,
  purgeExpiredGameSessions,
} from '../../src/scheduler/purge.js';
import { setupDatabase, teardownDatabase } from './helpers/database.js';

interface ResultMatch {
  matchId: string;
  sessionId: string;
  mode: string;
  difficulty: string;
  totalScore: number;
  results: Array<{
    id: string;
    roundNumber: number;
    actual: { lat: number; lon: number };
    guess: { lat: number; lon: number } | null;
    distanceKm: number | null;
    score: number;
    createdAt: string;
  }>;
}

describe('authenticated result history', () => {
  let db: PrismaClient;
  let app: FastifyInstance;
  const userIds: string[] = [];

  beforeAll(async () => {
    db = await setupDatabase();
    app = Fastify({ logger: { level: 'silent' } });
    registerErrorHandler(app);
    registerResultsRoutes(app, db);
    registerStatisticsRoutes(app, db);
  });

  afterAll(async () => {
    await db.gameResult.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
    await teardownDatabase(db);
  });

  async function signIn(name: string) {
    const user = await db.user.create({
      data: {
        email: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
        displayName: name,
      },
    });
    userIds.push(user.id);
    const token = await createUserSession(db, user.id);
    return { user, cookie: `tg_session=${token}` };
  }

  function row(
    id: string,
    userId: string,
    matchId: string,
    roundNumber: number,
    createdAt: string,
    score: number,
  ) {
    return {
      id,
      userId,
      mode: 'solo' as const,
      difficulty: 'medium' as const,
      sessionId: `session-${matchId}`,
      matchId,
      roundNumber,
      actualLat: 50,
      actualLon: 10,
      guessLat: 48,
      guessLon: 11,
      distanceKm: 250.5,
      score,
      createdAt: new Date(createdAt),
    };
  }

  it('requires a signed-in account', async () => {
    const response = await app.inject({ url: '/api/me/results' });
    expect(response.statusCode).toBe(401);
  });

  it.each([
    {
      checkedAt: '2021-02-28T03:00:00.000Z',
      expired: ['2020-08-28T03:00:00.000Z', '2020-08-31T03:00:00.000Z'],
      retained: ['2020-08-28T03:00:00.001Z', '2020-08-31T03:00:00.001Z', '2020-09-01T00:00:00.000Z'],
    },
    {
      checkedAt: '2024-02-29T03:00:00.000Z',
      expired: ['2023-08-30T03:00:00.000Z', '2023-08-31T03:00:00.000Z'],
      retained: ['2023-08-31T03:00:00.001Z'],
    },
  ])('expires results on the six-month calendar boundary at $checkedAt', async ({ checkedAt, expired, retained }) => {
    const { user } = await signIn('Retention Player');
    const matchId = `retention-${user.id}`;
    const dates = [...expired, ...retained];
    await db.gameResult.createMany({
      data: dates.map((date, index) => row(
        `${matchId}-${index}`, user.id, matchId, index + 1, date, 1000,
      )),
    });

    try {
      const summary = await purgeExpiredGameResults(db, new Date(checkedAt));
      expect(summary.deletedResults).toBeGreaterThanOrEqual(expired.length);
      const remaining = await db.gameResult.findMany({
        where: { userId: user.id },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(remaining.map((result) => result.createdAt.toISOString())).toEqual(retained);
    } finally {
      await db.gameResult.deleteMany({ where: { userId: user.id } });
    }
  });

  it('returns only the caller\'s matches, grouped by matchId and paginated', async () => {
    const owner = await signIn('Result Owner');
    const other = await signIn('Other Result Owner');
    await db.gameResult.createMany({
      data: [
        row('a1-r1', owner.user.id, 'match-a1', 1, '2026-11-20T12:00:00.000Z', 1000),
        row('a1-r2', owner.user.id, 'match-a1', 2, '2026-11-20T12:01:00.000Z', 2000),
        row('a2-r1', owner.user.id, 'match-a2', 1, '2026-11-21T12:00:00.000Z', 3000),
        row('b1-r1', other.user.id, 'match-b1', 1, '2026-11-22T12:00:00.000Z', 4000),
      ],
    });

    const firstPage = await app.inject({
      url: '/api/me/results?limit=1&offset=0',
      headers: { cookie: owner.cookie },
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.headers['cache-control']).toBe('private, no-store');
    const first = firstPage.json() as {
      matches: ResultMatch[];
      total: number;
      offset: number;
      limit: number;
    };
    expect(first.total).toBe(2);
    expect(first.matches).toHaveLength(1);
    expect(first.matches[0]?.matchId).toBe('match-a2');
    expect(first.matches[0]?.results).toHaveLength(1);

    const secondPage = await app.inject({
      url: '/api/me/results?limit=1&offset=1',
      headers: { cookie: owner.cookie },
    });
    const second = secondPage.json() as typeof first;
    expect(second.matches).toHaveLength(1);
    expect(second.matches[0]).toMatchObject({
      matchId: 'match-a1',
      mode: 'solo',
      difficulty: 'medium',
      totalScore: 3000,
    });
    expect(second.matches[0]?.results.map((result) => result.roundNumber)).toEqual([
      1,
      2,
    ]);
    expect(second.matches[0]?.results[0]?.guess).toEqual({ lat: 48, lon: 11 });
    expect(await db.gameResult.count({ where: { matchId: 'match-b1', userId: owner.user.id } })).toBe(0);
  });

  it('settles and archives an unattended timed-out authenticated solo round before session purge', async () => {
    const { user, cookie } = await signIn('Unattended Solo');
    const past = new Date(Date.now() - 60_000);
    const game = await db.streetGame.create({
      data: {
        playerTokenHash: `tok-${Date.now()}-${Math.random()}`,
        ownerUserId: user.id,
        difficulty: 'medium',
        expiresAt: past,
        rounds: {
          create: {
            number: 1,
            panoId: 'unattended-pano',
            targetIndex: 0,
            targetLat: 51.5074,
            targetLon: -0.1278,
            startedAt: new Date(past.getTime() - 240_000),
            endsAt: past,
            selectionLat: 51.5,
            selectionLon: -0.12,
          },
        },
      },
      include: { rounds: true },
    });

    const summary = await purgeExpiredGameSessions(db, new Date());
    expect(summary.settledStreetRounds).toBeGreaterThanOrEqual(1);
    expect(summary.deletedStreetGames).toBeGreaterThanOrEqual(1);

    // Live session is gone, but the timed-out round was scored and durably archived.
    expect(await db.streetGame.findUnique({ where: { id: game.id } })).toBeNull();
    const archived = await db.gameResult.findUniqueOrThrow({
      where: { id: `solo:${game.rounds[0]!.id}` },
    });
    expect(archived).toMatchObject({
      userId: user.id,
      mode: 'solo',
      sessionId: game.id,
      actualLat: 51.5074,
      actualLon: -0.1278,
      guessLat: 51.5,
      guessLon: -0.12,
      score: 5000,
    });

    const history = await app.inject({ url: '/api/me/results', headers: { cookie } });
    expect(history.statusCode).toBe(200);
    expect((history.json() as { total: number }).total).toBe(1);
  });

  it('settles unattended timed-out rounds on /api/me/results without revealing active multiplayer rounds early', async () => {
    const p1 = await signIn('Disconnected P1');
    const p2 = await signIn('Disconnected P2');
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60 * 60_000);

    // 1) Disconnected solo round whose timer expired while session is still alive.
    const soloGame = await db.streetGame.create({
      data: {
        playerTokenHash: `tok-solo-${Date.now()}-${Math.random()}`,
        ownerUserId: p1.user.id,
        difficulty: 'hard',
        expiresAt: future,
        rounds: {
          create: {
            number: 1,
            panoId: 'disconnected-solo-pano',
            targetIndex: 1,
            targetLat: 48.8566,
            targetLon: 2.3522,
            startedAt: new Date(past.getTime() - 120_000),
            endsAt: past,
            selectionLat: 48.85,
            selectionLon: 2.35,
          },
        },
      },
    });

    // 2) Active multiplayer lobby where P1 timed out via Hard penalty, but P2 STILL has time left.
    const activeLobby = await db.lobby.create({
      data: {
        code: `A${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(0, 6),
        difficulty: 'hard',
        hostTokenHash: `host-a-${Date.now()}`,
        status: 'playing',
        currentRound: 1,
        expiresAt: future,
        members: {
          create: [
            { userId: p1.user.id, playerTokenHash: `host-a-${Date.now()}`, selectionLat: 51.5, selectionLon: -0.12 },
            { userId: p2.user.id, playerTokenHash: `guest-a-${Date.now()}` },
          ],
        },
      },
      include: { members: true },
    });
    const activeRound = await db.lobbyRound.create({
      data: {
        lobbyId: activeLobby.id,
        number: 1,
        panoId: 'active-lobby-pano',
        targetIndex: 0,
        targetLat: 51.5074,
        targetLon: -0.1278,
        startedAt: new Date(Date.now() - 100_000),
        endsAt: new Date(Date.now() + 20_000), // P2 still has 20s left
      },
    });
    await db.lobbyRoundMemberState.create({
      data: {
        roundId: activeRound.id,
        memberId: activeLobby.members[0]!.id,
        extraDataUnlockedAt: past,
        endsAt: past, // P1 already timed out
      },
    });

    // 3) Fully timed-out multiplayer lobby (both players past deadline) ready for purge.
    const expiredLobby = await db.lobby.create({
      data: {
        code: `E${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(0, 6),
        difficulty: 'medium',
        hostTokenHash: `host-e-${Date.now()}`,
        status: 'playing',
        currentRound: 1,
        expiresAt: past,
        members: {
          create: [
            { userId: p1.user.id, playerTokenHash: `host-e-${Date.now()}`, selectionLat: 51.5, selectionLon: -0.12 },
            { userId: p2.user.id, playerTokenHash: `guest-e-${Date.now()}` },
          ],
        },
        rounds: {
          create: {
            number: 1,
            panoId: 'expired-lobby-pano',
            targetIndex: 0,
            targetLat: 51.5074,
            targetLon: -0.1278,
            startedAt: new Date(past.getTime() - 240_000),
            endsAt: past,
          },
        },
      },
    });

    try {
      // P1 checks /api/me/results: sees their timed-out solo round AND the fully timed-out lobby,
      // but NOT the active lobby where P2 still has time left!
      const res = await app.inject({ url: '/api/me/results', headers: { cookie: p1.cookie } });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { matches: ResultMatch[]; total: number };
      const sessionIds = body.matches.map((m) => m.sessionId);
      expect(sessionIds).toContain(soloGame.id);
      expect(sessionIds).toContain(expiredLobby.id);
      expect(sessionIds).not.toContain(activeLobby.id);

      // Session purge archives & deletes expiredLobby without losing P2's zero-guess timeout result.
      const purge = await purgeExpiredGameSessions(db, new Date());
      expect(purge.deletedLobbies).toBeGreaterThanOrEqual(1);
      expect(await db.lobby.findUnique({ where: { id: expiredLobby.id } })).toBeNull();
      const p2Archived = await db.gameResult.findFirstOrThrow({
        where: { userId: p2.user.id, sessionId: expiredLobby.id },
      });
      expect(p2Archived).toMatchObject({ guessLat: null, guessLon: null, score: 0 });
    } finally {
      await db.streetGame.deleteMany({ where: { id: soloGame.id } });
      await db.lobby.deleteMany({ where: { id: { in: [activeLobby.id, expiredLobby.id] } } });
    }
  });

  it('serves /api/me/statistics and mode/difficulty-filtered /api/me/results with enriched fields', async () => {
    const unauth = await app.inject({ url: '/api/me/statistics' });
    expect(unauth.statusCode).toBe(401);

    const { user, cookie } = await signIn('Stats Explorer');
    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    await db.gameResult.createMany({
      data: [
        {
          ...row(`st-1-${user.id}`, user.id, `m-solo-${user.id}`, 1, recent.toISOString(), 5000),
          distanceKm: 42,
          placeName: 'Reykjavik',
          biome: 'tundra',
          weather: 'snow',
          temperatureBand: 'freezing',
          attemptsUsed: 1,
          extraDataUnlocked: true,
          extraDataPointsSpent: 100,
          elapsedSeconds: 52,
        },
        {
          ...row(`st-2-${user.id}`, user.id, `m-mp-${user.id}`, 1, now.toISOString(), 4200),
          mode: 'multiplayer',
          difficulty: 'hard',
          distanceKm: 650,
          placeName: 'Lisbon',
          biome: 'coast',
          weather: 'clear',
          temperatureBand: 'warm',
          attemptsUsed: 1,
          extraDataUnlocked: false,
          extraDataPointsSpent: 0,
          elapsedSeconds: 70,
          matchPlacement: 1,
          matchPlayerCount: 3,
        },
      ],
    });

    const statsRes = await app.inject({
      url: '/api/me/statistics?period=30d&mode=all&difficulty=all',
      headers: { cookie },
    });
    expect(statsRes.statusCode).toBe(200);
    expect(statsRes.headers['cache-control']).toBe('private, no-store');
    const stats = statsRes.json() as {
      kpis: { roundsPlayed: number; matchesPlayed: number; perfectCount: number };
      multiplayer: { finishedMatches: number; wins: number; winRate: number | null };
      environment: { sampleSize: number };
      personalBests: { bestRound: { placeName: string | null } | null };
    };
    expect(stats.kpis.roundsPlayed).toBe(2);
    expect(stats.kpis.matchesPlayed).toBe(2);
    expect(stats.kpis.perfectCount).toBe(1);
    expect(stats.multiplayer).toMatchObject({ finishedMatches: 1, wins: 1, winRate: 100 });
    expect(stats.environment.sampleSize).toBe(2);
    expect(stats.personalBests.bestRound?.placeName).toBe('Reykjavik');

    const filtered = await app.inject({
      url: '/api/me/results?mode=multiplayer&difficulty=hard',
      headers: { cookie },
    });
    expect(filtered.statusCode).toBe(200);
    const filteredBody = filtered.json() as {
      total: number;
      matches: Array<ResultMatch & { matchPlacement: number | null; matchPlayerCount: number | null }>;
    };
    expect(filteredBody.total).toBe(1);
    expect(filteredBody.matches[0]?.matchPlacement).toBe(1);
    expect(filteredBody.matches[0]?.matchPlayerCount).toBe(3);
  });
});
