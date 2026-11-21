import './helpers/env.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { registerResultsRoutes } from '../../src/modules/results/routes.js';
import { createUserSession } from '../../src/modules/auth/service.js';
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

describe('authenticated result history (R18)', () => {
  let db: PrismaClient;
  let app: FastifyInstance;
  const userIds: string[] = [];

  beforeAll(async () => {
    db = await setupDatabase();
    app = Fastify({ logger: { level: 'silent' } });
    registerErrorHandler(app);
    registerResultsRoutes(app, db);
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
});
