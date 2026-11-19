import './helpers/env.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { registerSingleplayerRoutes } from '../../src/modules/singleplayer/routes.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { PanoramaError } from '../../src/modules/singleplayer/provider.js';
import { haversineKm } from '../../src/domain/distance.js';
import { scoreForDistance } from '../../src/domain/scoring.js';
import { runMigrations } from './helpers/database.js';

// Real PostgreSQL persistence and HTTP validation, explicit provider doubles.
describe('Street View singleplayer lifecycle (database integration; provider doubles)', () => {
  const db = new PrismaClient();
  const app = Fastify();
  const ids: string[] = [];
  const provider = vi.fn(async (used: number[]) => ({
    panoId: `test-only-pano-${used.length}`,
    targetIndex: used.length,
    lat: 50,
    lon: 10,
  }));
  const locate = vi.fn(async () => ({ lat: 50.0001, lon: 10.0001 }));
  beforeAll(async () => {
    runMigrations(process.env.DATABASE_URL!);
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, { db, provider, locate });
  });
  afterAll(async () => {
    await app.close();
    await db.streetGame.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  async function create() {
    const response = await app.inject({
      method: 'POST',
      url: '/api/singleplayer/games',
    });
    expect(response.statusCode).toBe(201);
    const auth = response.json();
    ids.push(auth.id);
    return {
      base: `/api/singleplayer/games/${auth.id}`,
      headers: { 'x-player-token': auth.playerToken },
      id: auth.id,
    };
  }
  it('is honestly unavailable with missing server credentials', async () => {
    const unavailable = Fastify();
    registerErrorHandler(unavailable);
    registerSingleplayerRoutes(unavailable, { db });
    expect(
      (await unavailable.inject('/api/singleplayer/config')).json(),
    ).toEqual({ available: false });
    const response = await unavailable.inject({
      method: 'POST',
      url: '/api/singleplayer/games',
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('STREET_VIEW_UNAVAILABLE');
    await unavailable.close();
  });
  it('plays five rounds, reveals answers only after guessing, and persists exact geodesic scores', async () => {
    const auth = await create();
    let total = 0;
    for (let number = 1; number <= 5; number++) {
      const started = await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds`,
        headers: auth.headers,
      });
      expect(started.statusCode).toBe(200);
      const round = started.json();
      expect(round.number).toBe(number);
      expect(Object.keys(round).sort()).toEqual(['id', 'number', 'panoId']);
      const resumed = await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds`,
        headers: auth.headers,
      });
      expect(resumed.json()).toEqual(round);
      const session = (
        await app.inject({ url: auth.base, headers: auth.headers })
      ).json();
      expect(session.activeRound).toEqual(round);
      expect(session.results).toHaveLength(number - 1);
      const url = `${auth.base}/rounds/${round.id}/guess`;
      const payload = { lat: 48.8566, lon: 2.3522 };
      const scored = await app.inject({
        method: 'POST',
        url,
        headers: auth.headers,
        payload,
      });
      expect(scored.statusCode).toBe(200);
      const result = scored.json();
      const expectedDistance = haversineKm(payload, {
        lat: 50.0001,
        lon: 10.0001,
      });
      expect(result.actual).toEqual({ lat: 50.0001, lon: 10.0001 });
      expect(result.distanceKm).toBeCloseTo(expectedDistance, 8);
      expect(result.score).toBe(scoreForDistance(expectedDistance));
      total += result.score;
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers: auth.headers,
            payload,
          })
        ).json(),
      ).toEqual(result);
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers: auth.headers,
            payload: { lat: 0, lon: 0 },
          })
        ).statusCode,
      ).toBe(409);
    }
    const final = (
      await app.inject({ url: auth.base, headers: auth.headers })
    ).json();
    expect(final.completed).toBe(true);
    expect(final.activeRound).toBeNull();
    expect(final.results).toHaveLength(5);
    expect(final.totalScore).toBe(total);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `${auth.base}/rounds`,
          headers: auth.headers,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('rejects missing/wrong ownership and invalid coordinates and client-submitted scores', async () => {
    const auth = await create();
    expect((await app.inject(auth.base)).statusCode).toBe(404);
    expect(
      (
        await app.inject({
          url: auth.base,
          headers: { 'x-player-token': 'wrong' },
        })
      ).statusCode,
    ).toBe(404);
    const round = (
      await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds`,
        headers: auth.headers,
      })
    ).json();
    for (const payload of [
      { lat: 91, lon: 0 },
      { lat: 0, lon: 181 },
      { lat: 'zero', lon: null },
      { lat: null, lon: 0 },
      { lat: '10', lon: 20 },
    ]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `${auth.base}/rounds/${round.id}/guess`,
            headers: auth.headers,
            payload,
          })
        ).statusCode,
      ).toBe(400);
    }
    // Fastify strips additional fields; they never influence score calculation.
    const guessed = await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: -50, lon: -100, score: 5000 },
    });
    expect(guessed.statusCode).toBe(200);
    expect(guessed.json().score).toBeLessThan(100);
  });
  it('locks concurrent different guesses atomically', async () => {
    const auth = await create();
    const round = (
      await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds`,
        headers: auth.headers,
      })
    ).json();
    const responses = await Promise.all(
      [0, 10].map((lat) =>
        app.inject({
          method: 'POST',
          url: `${auth.base}/rounds/${round.id}/guess`,
          headers: auth.headers,
          payload: { lat, lon: 0 },
        }),
      ),
    );
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      await db.streetRound.findMany({
        where: { gameId: auth.id, score: { not: null } },
      }),
    ).toHaveLength(1);
  });
  it('recovers provider failures without creating fake rounds', async () => {
    const auth = await create();
    provider.mockRejectedValueOnce(new PanoramaError('No coverage.'));
    const failed = await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds`,
      headers: auth.headers,
    });
    expect(failed.statusCode).toBe(503);
    expect(failed.json().error.message).toBe('No coverage.');
    expect(await db.streetRound.count({ where: { gameId: auth.id } })).toBe(0);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `${auth.base}/rounds`,
          headers: auth.headers,
        })
      ).statusCode,
    ).toBe(200);
  });
  it('rejects expired sessions', async () => {
    const auth = await create();
    await db.streetGame.update({
      where: { id: auth.id },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (await app.inject({ url: auth.base, headers: auth.headers })).statusCode,
    ).toBe(404);
  });
});

describe('Street View scoring availability (real database; provider doubles)', () => {
  const db = new PrismaClient();
  const app = Fastify();
  let id: string | undefined;
  const locate = vi.fn(async () => ({ lat: 50.0001, lon: 10.0001 }));
  beforeAll(() => {
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db,
      locate,
      provider: async () => ({
        panoId: 'test-only-pano',
        targetIndex: 0,
        lat: 50,
        lon: 10,
      }),
    });
  });
  afterAll(async () => {
    await app.close();
    if (id) await db.streetGame.delete({ where: { id } });
    await db.$disconnect();
  });
  it('does not score or lock a guess if its panorama position cannot be verified', async () => {
    const auth = (
      await app.inject({ method: 'POST', url: '/api/singleplayer/games' })
    ).json();
    id = auth.id;
    const base = `/api/singleplayer/games/${id}`;
    const headers = { 'x-player-token': auth.playerToken };
    const round = (
      await app.inject({ method: 'POST', url: `${base}/rounds`, headers })
    ).json();
    locate.mockRejectedValueOnce(
      new PanoramaError(
        'The panorama position could not be verified. Please retry.',
      ),
    );
    const request = {
      method: 'POST' as const,
      url: `${base}/rounds/${round.id}/guess`,
      headers,
      payload: { lat: 10, lon: 20 },
    };
    const failed = await app.inject(request);
    expect(failed.statusCode).toBe(503);
    expect(failed.json().error).toEqual({
      code: 'STREET_VIEW_UNAVAILABLE',
      message: 'The panorama position could not be verified. Please retry.',
    });
    expect(
      (await db.streetRound.findUniqueOrThrow({ where: { id: round.id } }))
        .score,
    ).toBeNull();
    expect((await app.inject(request)).statusCode).toBe(200);
  });
});
