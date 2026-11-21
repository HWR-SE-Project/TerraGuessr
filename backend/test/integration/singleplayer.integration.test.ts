import './helpers/env.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { registerSingleplayerRoutes } from '../../src/modules/singleplayer/routes.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { PanoramaError } from '../../src/modules/singleplayer/provider.js';
import { haversineKm } from '../../src/domain/distance.js';
import { scoreForDistance } from '../../src/domain/scoring.js';
import { createUserSession } from '../../src/modules/auth/service.js';
import { runMigrations } from './helpers/database.js';
import type { GeographicIntelligence } from '../../src/modules/intelligence/contract.js';

/** A deterministic, always-valid weather payload (R03) — explicit provider
 * double so these tests never depend on real network access. */
function validIntelligence(): GeographicIntelligence {
  return {
    fetchedAt: new Date().toISOString(),
    cached: false,
    weather: {
      modelTime: null,
      temperatureC: 18,
      condition: 'Clear sky',
      windSpeedKmh: 10,
      windDirectionDeg: 180,
      humidityPct: 40,
      pressureHpa: 1013,
      precipitationMm: 0,
      precipitationIntervalMinutes: null,
    },
    environment: {
      elevationM: 100,
      reliefM: 10,
      terrain: 'Low relief',
      biome: null,
      vegetation: null,
    },
    climate: null,
  };
}

/** Creates a directly-authenticated test account and its session cookie. */
async function signIn(db: PrismaClient, name: string) {
  const user = await db.user.create({
    data: {
      email: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
      displayName: name,
    },
  });
  const token = await createUserSession(db, user.id);
  return { user, cookie: `tg_session=${token}` };
}

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
  const intelligence = vi.fn(async () => validIntelligence());
  beforeAll(async () => {
    runMigrations(process.env.DATABASE_URL!);
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, { db, provider, locate, intelligence });
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
    ).toEqual({
      available: false,
      provider: 'google',
      serverKeyConfigured: false,
    });
    const response = await unavailable.inject({
      method: 'POST',
      url: '/api/singleplayer/games',
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('MISSING_SERVER_KEY');
    await unavailable.close();
  });
  it('plays ten consecutive rounds with no cap, reveals answers only after guessing, and persists exact geodesic scores', async () => {
    const auth = await create();
    let total = 0;
    const ROUNDS = 10; // Past the old five-round cap (R01/endless mode).
    for (let number = 1; number <= ROUNDS; number++) {
      const started = await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds`,
        headers: auth.headers,
      });
      expect(started.statusCode).toBe(200);
      const round = started.json();
      expect(round.number).toBe(number);
      expect(Object.keys(round).sort()).toEqual([
        'attemptsTotal',
        'attemptsUsed',
        'endsAt',
        'extraData',
        'id',
        'number',
        'panoId',
        'startedAt',
      ]);
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
      expect(session).not.toHaveProperty('roundsTotal');
      expect(session).not.toHaveProperty('completed');
      const url = `${auth.base}/rounds/${round.id}/guess`;
      const payload = { lat: 48.8566, lon: 2.3522, final: true };
      const scored = await app.inject({
        method: 'POST',
        url,
        headers: auth.headers,
        payload,
      });
      expect(scored.statusCode).toBe(200);
      const response = scored.json();
      const result = response.result;
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
      ).toEqual(response);
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers: auth.headers,
            payload: { lat: 0, lon: 0, final: true },
          })
        ).statusCode,
      ).toBe(409);
    }
    const afterTen = (
      await app.inject({ url: auth.base, headers: auth.headers })
    ).json();
    expect(afterTen.activeRound).toBeNull();
    expect(afterTen.results).toHaveLength(ROUNDS);
    expect(afterTen.totalScore).toBe(total);
    // Endless mode: starting round eleven (and beyond) never 409s.
    const eleventh = await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds`,
      headers: auth.headers,
    });
    expect(eleventh.statusCode).toBe(200);
    expect(eleventh.json().number).toBe(ROUNDS + 1);
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
      payload: { lat: -50, lon: -100, score: 5000, final: true },
    });
    expect(guessed.statusCode).toBe(200);
    const expectedScore = scoreForDistance(
      haversineKm({ lat: -50, lon: -100 }, { lat: 50.0001, lon: 10.0001 }),
    );
    expect(guessed.json().result.score).toBe(expectedScore);
    expect(guessed.json().result.score).not.toBe(5000);
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
          payload: { lat, lon: 0, final: true },
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

describe('abandoning an expedition (explicit exit, database integration)', () => {
  const db = new PrismaClient();
  const app = Fastify();
  const ids: string[] = [];
  const userIds: string[] = [];
  beforeAll(() => {
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db,
      provider: async (used) => ({
        panoId: `abandon-pano-${used.length}`,
        targetIndex: used.length,
        lat: 50,
        lon: 10,
      }),
      locate: async () => ({ lat: 50, lon: 10 }),
      intelligence: async () => validIntelligence(),
    });
  });
  afterAll(async () => {
    await app.close();
    await db.gameResult.deleteMany({ where: { sessionId: { in: ids } } });
    await db.streetGame.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });
  async function create(cookie?: string) {
    const auth = (
      await app.inject({
        method: 'POST',
        url: '/api/singleplayer/games',
        headers: cookie ? { cookie } : undefined,
      })
    ).json();
    ids.push(auth.id);
    return {
      base: `/api/singleplayer/games/${auth.id}`,
      headers: {
        'x-player-token': auth.playerToken,
        ...(cookie ? { cookie } : {}),
      },
      id: auth.id as string,
    };
  }
  it('rejects abandon without ownership and leaves the session untouched', async () => {
    const auth = await create();
    expect((await app.inject({ method: 'DELETE', url: auth.base })).statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: auth.base,
          headers: { 'x-player-token': 'wrong' },
        })
      ).statusCode,
    ).toBe(404);
    // Still there: the failed attempts never deleted it.
    expect((await app.inject({ url: auth.base, headers: auth.headers })).statusCode).toBe(200);
  });
  it('deletes the session and cascades its unscored round, but preserves the archived result of a scored one', async () => {
    const account = await signIn(db, 'Archive Abandoner');
    userIds.push(account.user.id);
    const auth = await create(account.cookie);
    const first = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${first.id}/guess`,
      headers: auth.headers,
      payload: { lat: 48, lon: 11, final: true },
    });
    const second = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const deleted = await app.inject({ method: 'DELETE', url: auth.base, headers: auth.headers });
    expect(deleted.statusCode).toBe(204);
    expect(
      (await app.inject({ url: auth.base, headers: auth.headers })).statusCode,
    ).toBe(404);
    expect(
      await db.streetRound.count({ where: { id: { in: [first.id, second.id] } } }),
    ).toBe(0);
    const archived = await db.gameResult.findUniqueOrThrow({
      where: { id: `solo:${first.id}` },
    });
    expect(archived.sessionId).toBe(auth.id);
    expect(archived.userId).toBe(account.user.id);
    expect(archived.score).toBeGreaterThan(0);
  });
  it('is idempotent: abandoning an already-deleted session reports not-found rather than erroring', async () => {
    const auth = await create();
    expect(
      (await app.inject({ method: 'DELETE', url: auth.base, headers: auth.headers })).statusCode,
    ).toBe(204);
    expect(
      (await app.inject({ method: 'DELETE', url: auth.base, headers: auth.headers })).statusCode,
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
      intelligence: async () => validIntelligence(),
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
      payload: { lat: 10, lon: 20, final: true },
    };
    const failed = await app.inject(request);
    expect(failed.statusCode).toBe(503);
    expect(failed.json().error).toEqual({
      code: 'PANORAMA_UNAVAILABLE',
      message: 'The panorama position could not be verified. Please retry.',
    });
    expect(
      (await db.streetRound.findUniqueOrThrow({ where: { id: round.id } }))
        .score,
    ).toBeNull();
    expect((await app.inject(request)).statusCode).toBe(200);
  });
});

describe('replacing unavailable Street View locations (database integration)', () => {
  const db = new PrismaClient();
  const app = Fastify();
  const ids: string[] = [];
  let release: (() => void) | undefined;
  let locating: (() => void) | undefined;
  let pauseLookup = false;
  beforeAll(() => {
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db,
      provider: async (used) => ({
        panoId: `retry-test-pano-${used.length}`,
        targetIndex: used.length,
        lat: 50,
        lon: 10,
      }),
      locate: async () => {
        if (pauseLookup) {
          locating?.();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return { lat: 50, lon: 10 };
      },
      intelligence: async () => validIntelligence(),
    });
  });
  afterAll(async () => {
    release?.();
    await app.close();
    await db.streetGame.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  async function start() {
    const auth = (
      await app.inject({ method: 'POST', url: '/api/singleplayer/games' })
    ).json();
    ids.push(auth.id);
    const base = `/api/singleplayer/games/${auth.id}`;
    const headers = { 'x-player-token': auth.playerToken };
    const round = (
      await app.inject({ method: 'POST', url: `${base}/rounds`, headers })
    ).json();
    return { base, headers, round };
  }
  it('replaces the image in the same round, hides its answer, and rejects replacements after scoring', async () => {
    const { base, headers, round } = await start();
    const url = `${base}/rounds/${round.id}/retry`;
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(404);
    const retried = await app.inject({ method: 'POST', url, headers });
    expect(retried.statusCode).toBe(200);
    expect(retried.json()).toMatchObject({
      id: round.id,
      number: 1,
      // Index 3: R01 proximity exclusion also rules out targets 1 and 4
      // (within 400km of target 0's coordinates), so the retry's exclusion
      // list is length 3, not 1, by the time this double's `used.length`
      // picks the replacement index.
      panoId: 'retry-test-pano-3',
      attemptsUsed: 0,
      attemptsTotal: 2,
    });
    const before = (await app.inject({ url: base, headers })).json();
    expect(before.results).toEqual([]);
    expect(before.totalScore).toBe(0);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `${base}/rounds/${round.id}/guess`,
          headers,
          payload: { lat: 50, lon: 10, final: true },
        })
      ).json().result.score,
    ).toBe(5000);
    expect(
      (await app.inject({ method: 'POST', url, headers })).statusCode,
    ).toBe(409);
  });
  it('cannot score an old image while a replacement commits concurrently', async () => {
    const { base, headers, round } = await start();
    pauseLookup = true;
    const lookupStarted = new Promise<void>((resolve) => {
      locating = resolve;
    });
    const guess = app
      .inject({
        method: 'POST',
        url: `${base}/rounds/${round.id}/guess`,
        headers,
        payload: { lat: 50, lon: 10, final: true },
      })
      .then((response) => response);
    await lookupStarted;
    const retried = await app.inject({
      method: 'POST',
      url: `${base}/rounds/${round.id}/retry`,
      headers,
    });
    expect(retried.statusCode).toBe(200);
    release?.();
    const scored = await guess;
    expect(scored.statusCode).toBe(409);
    const persisted = await db.streetRound.findUniqueOrThrow({
      where: { id: round.id },
    });
    expect(persisted.score).toBeNull();
    expect(persisted.panoId).toBe('retry-test-pano-3');
    pauseLookup = false;
  });
});

describe('difficulty levels and list-mode candidates (R05/R07)', () => {
  const db = new PrismaClient();
  const app = Fastify();
  const ids: string[] = [];
  const provider = vi.fn(async (used: number[]) => ({
    panoId: `difficulty-pano-${used.length}`,
    targetIndex: used.length,
    lat: 50,
    lon: 10,
  }));
  beforeAll(() => {
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db,
      provider,
      locate: async () => ({ lat: 50, lon: 10 }),
      intelligence: async () => validIntelligence(),
    });
  });
  afterAll(async () => {
    await app.close();
    await db.streetGame.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  async function create(difficulty?: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/singleplayer/games',
      payload: difficulty ? { difficulty } : undefined,
    });
    const auth = response.json();
    ids.push(auth.id);
    return {
      base: `/api/singleplayer/games/${auth.id}`,
      headers: { 'x-player-token': auth.playerToken },
      id: auth.id,
    };
  }
  it('defaults to medium (no candidates) when no difficulty is requested', async () => {
    const auth = await create();
    const session = (await app.inject({ url: auth.base, headers: auth.headers })).json();
    expect(session.difficulty).toBe('medium');
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    expect(round.candidates).toBeUndefined();
  });
  it('rejects an unrecognized difficulty value by falling back to medium', async () => {
    const auth = await create('expert');
    const session = (await app.inject({ url: auth.base, headers: auth.headers })).json();
    expect(session.difficulty).toBe('medium');
  });
  it('offers a 6-option candidate list including the actual target on easy, never leaking which one is correct', async () => {
    const auth = await create('easy');
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    expect(round.candidates).toHaveLength(6);
    const ids = round.candidates.map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(6);
    // The server never marks which candidate is correct in the payload.
    for (const candidate of round.candidates) {
      expect(Object.keys(candidate).sort()).toEqual(['id', 'lat', 'lon', 'name', 'region']);
    }
    // Resuming the session redisplays the same list instead of re-rolling it.
    const resumed = (await app.inject({ url: auth.base, headers: auth.headers })).json();
    expect(resumed.activeRound.candidates).toEqual(round.candidates);
  });
  it('keeps an easy round open until the third attempt and returns no result early', async () => {
    const auth = await create('easy');
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const guess = () =>
      app.inject({
        method: 'POST',
        url: `${auth.base}/rounds/${round.id}/guess`,
        headers: auth.headers,
        payload: { lat: 50, lon: 10 },
      });
    const first = (await guess()).json();
    expect(first).toMatchObject({ finalized: false, attemptsRemaining: 2 });
    expect(first.result).toBeUndefined();
    const afterFirst = (
      await app.inject({ url: auth.base, headers: auth.headers })
    ).json();
    expect(afterFirst.results).toHaveLength(0);
    expect(afterFirst.activeRound.attemptsUsed).toBe(1);
    const second = (await guess()).json();
    expect(second).toMatchObject({ finalized: false, attemptsRemaining: 1 });
    const third = (await guess()).json();
    expect(third.finalized).toBe(true);
    expect(third.result.score).toBe(5000);
  });
  it('deducts the medium extra-data cost from the round score', async () => {
    const auth = await create('medium');
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const unlocked = await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/unlock`,
      headers: auth.headers,
    });
    expect(unlocked.statusCode).toBe(200);
    expect(unlocked.json().extraData).toMatchObject({
      mode: 'points',
      cost: 100,
      unlocked: true,
    });
    const scored = (
      await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds/${round.id}/guess`,
        headers: auth.headers,
        payload: { lat: 50, lon: 10, final: true },
      })
    ).json();
    expect(scored.result.score).toBe(4900);
  });
  it('applies the hard extra-data time penalty to the round deadline', async () => {
    const auth = await create('hard');
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const unlocked = (
      await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds/${round.id}/unlock`,
        headers: auth.headers,
      })
    ).json();
    expect(unlocked.extraData.unlocked).toBe(true);
    const remainingMs =
      Date.parse(unlocked.endsAt) - Date.parse(unlocked.startedAt);
    expect(remainingMs).toBeLessThanOrEqual(100_000);
    expect(remainingMs).toBeGreaterThan(95_000);
  });
});

describe('automatic location replacement on weather failure (R03/R13)', () => {
  const db = new PrismaClient();
  const app = Fastify();
  const ids: string[] = [];
  const provider = vi.fn(async (used: number[]) => ({
    panoId: `weather-pano-${used.length}`,
    targetIndex: used.length,
    lat: 50,
    lon: 10,
  }));
  const intelligence = vi.fn(async (): Promise<GeographicIntelligence> => ({
    ...validIntelligence(),
    weather: null,
  }));
  beforeAll(() => {
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db,
      provider,
      locate: async () => ({ lat: 50, lon: 10 }),
      intelligence,
    });
  });
  afterAll(async () => {
    await app.close();
    await db.streetGame.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  async function create() {
    const auth = (
      await app.inject({ method: 'POST', url: '/api/singleplayer/games' })
    ).json();
    ids.push(auth.id);
    return {
      base: `/api/singleplayer/games/${auth.id}`,
      headers: { 'x-player-token': auth.playerToken },
      id: auth.id as string,
    };
  }
  it('skips a location whose weather cannot be loaded and automatically tries another', async () => {
    const auth = await create();
    intelligence
      .mockResolvedValueOnce({ ...validIntelligence(), weather: null })
      .mockResolvedValueOnce(validIntelligence());
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    expect(round.panoId).toBe('weather-pano-1'); // index 0 was rejected for missing weather
    expect(await db.streetRound.count({ where: { panoId: 'weather-pano-0' } })).toBe(0);
  });
  it('never starts a round and returns a recoverable 503 when weather is unavailable everywhere', async () => {
    const auth = await create();
    const failed = await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds`,
      headers: auth.headers,
    });
    expect(failed.statusCode).toBe(503);
    expect(failed.json().error.code).toBe('WEATHER_UNAVAILABLE');
    expect(await db.streetRound.count({ where: { gameId: auth.id } })).toBe(0);
    // Recoverable: once weather is available, a normal retry succeeds.
    intelligence.mockResolvedValueOnce(validIntelligence());
    const retried = await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds`,
      headers: auth.headers,
    });
    expect(retried.statusCode).toBe(200);
  });
});

describe('next-round prefetch (R12)', () => {
  const db = new PrismaClient();
  const app = Fastify();
  const ids: string[] = [];
  const provider = vi.fn(async (used: number[]) => ({
    panoId: `prefetch-pano-${used.length}`,
    targetIndex: used.length,
    lat: 50,
    lon: 10,
  }));
  const intelligence = vi.fn(async () => validIntelligence());
  beforeAll(() => {
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db,
      provider,
      locate: async () => ({ lat: 50, lon: 10 }),
      intelligence,
    });
  });
  afterAll(async () => {
    await app.close();
    await db.streetGame.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  async function create() {
    const auth = (
      await app.inject({ method: 'POST', url: '/api/singleplayer/games' })
    ).json();
    ids.push(auth.id);
    return {
      base: `/api/singleplayer/games/${auth.id}`,
      headers: { 'x-player-token': auth.playerToken },
      id: auth.id,
    };
  }
  it('consumes a cached prefetch without calling the provider again, and clears it so it cannot be reused', async () => {
    const auth = await create();
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    // Seed a prefetch directly, as the background job (fire-and-forget) would.
    await db.streetGame.update({
      where: { id: auth.id },
      data: {
        nextTargetIndex: 99,
        nextPanoId: 'prefetched-pano',
        nextTargetLat: 12,
        nextTargetLon: 34,
      },
    });
    await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: 50, lon: 10, final: true },
    });
    const callsBefore = provider.mock.calls.length;
    const startedAt = performance.now();
    const next = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const elapsedMs = performance.now() - startedAt;
    expect(next.panoId).toBe('prefetched-pano');
    expect(provider.mock.calls.length).toBe(callsBefore); // fast path: no new provider call
    // R12: warm path only touches the database, so it comfortably clears the
    // 2-second next-round budget (the slow retry path is R13's concern, not
    // this one's).
    expect(elapsedMs).toBeLessThan(2000);
    const game = await db.streetGame.findUniqueOrThrow({ where: { id: auth.id } });
    expect(game.nextPanoId).toBeNull();
  });
  it('actually populates a prefetch in the background after a guess (fire-and-forget, event-driven)', async () => {
    const auth = await create();
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: 50, lon: 10, final: true },
    });
    let game = await db.streetGame.findUniqueOrThrow({ where: { id: auth.id } });
    for (let i = 0; i < 40 && !game.nextPanoId; i++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      game = await db.streetGame.findUniqueOrThrow({ where: { id: auth.id } });
    }
    expect(game.nextPanoId).not.toBeNull();
    expect(game.nextTargetIndex).not.toBeNull();
  });
  it('keeps prefetching past round five — endless mode has no completion point that stops it', async () => {
    const auth = await create();
    for (let number = 1; number <= 6; number++) {
      const round = (
        await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
      ).json();
      await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds/${round.id}/guess`,
        headers: auth.headers,
        payload: { lat: 50, lon: 10, final: true },
      });
    }
    let game = await db.streetGame.findUniqueOrThrow({ where: { id: auth.id } });
    for (let i = 0; i < 40 && !game.nextPanoId; i++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      game = await db.streetGame.findUniqueOrThrow({ where: { id: auth.id } });
    }
    expect(game.nextPanoId).not.toBeNull();
  });
});

describe('durable result archive (R18)', () => {
  const db = new PrismaClient();
  const app = Fastify();
  const ids: string[] = [];
  const userIds: string[] = [];
  beforeAll(() => {
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db,
      provider: async (used) => ({
        panoId: `archive-pano-${used.length}`,
        targetIndex: used.length,
        lat: 50,
        lon: 10,
      }),
      locate: async () => ({ lat: 50.25, lon: 10.25 }),
      intelligence: async () => validIntelligence(),
    });
  });
  afterAll(async () => {
    await app.close();
    await db.gameResult.deleteMany({ where: { sessionId: { in: ids } } });
    await db.streetGame.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });
  async function createGame(
    difficulty: string,
    cookie?: string,
  ) {
    const auth = (
      await app.inject({
        method: 'POST',
        url: '/api/singleplayer/games',
        headers: cookie ? { cookie } : undefined,
        payload: { difficulty },
      })
    ).json();
    ids.push(auth.id);
    return {
      base: `/api/singleplayer/games/${auth.id}`,
      headers: {
        'x-player-token': auth.playerToken,
        ...(cookie ? { cookie } : {}),
      },
      id: auth.id as string,
    };
  }
  it('archives an authenticated completed round with account and game data', async () => {
    const account = await signIn(db, 'Archive Player');
    userIds.push(account.user.id);
    const auth = await createGame('hard', account.cookie);
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const scored = (
      await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds/${round.id}/guess`,
        headers: auth.headers,
        payload: { lat: 48, lon: 11, final: true },
      })
    ).json();
    const archived = await db.gameResult.findUniqueOrThrow({
      where: { id: `solo:${round.id}` },
    });
    expect(archived.userId).toBe(account.user.id);
    expect(archived.mode).toBe('solo');
    expect(archived.sessionId).toBe(auth.id);
    expect(archived.roundNumber).toBe(round.number);
    expect(archived.difficulty).toBe('hard');
    expect(archived.actualLat).toBe(50.25);
    expect(archived.actualLon).toBe(10.25);
    expect(archived.guessLat).toBe(48);
    expect(archived.guessLon).toBe(11);
    expect(archived.score).toBe(scored.result.score);
    expect(archived.distanceKm).toBe(scored.result.distanceKm);
  });
  it('does not archive guest rounds', async () => {
    const auth = await createGame('hard');
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: 48, lon: 11, final: true },
    });
    expect(await db.gameResult.findUnique({ where: { id: `solo:${round.id}` } })).toBeNull();
  });
  it('archives the last submitted attempt, not the best one used for scoring', async () => {
    const account = await signIn(db, 'Archive Last Guess');
    userIds.push(account.user.id);
    const auth = await createGame('medium', account.cookie);
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: 0, lon: 0 },
    });
    await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: 48, lon: 11, final: true },
    });
    const archived = await db.gameResult.findUniqueOrThrow({
      where: { id: `solo:${round.id}` },
    });
    expect(archived.guessLat).toBe(48);
    expect(archived.guessLon).toBe(11);
  });
  it('survives deletion of the 24h-expired session and account deletion', async () => {
    const account = await signIn(db, 'Archive Survivor');
    const auth = await createGame('hard', account.cookie);
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: 48, lon: 11, final: true },
    });
    // Simulate the 24h session-expiry cleanup, which cascades StreetRound.
    await db.streetGame.delete({ where: { id: auth.id } });
    expect(await db.streetRound.count({ where: { id: round.id } })).toBe(0);
    // Account deletion anonymises the archive but must not delete it.
    await db.user.delete({ where: { id: account.user.id } });
    const archived = await db.gameResult.findUniqueOrThrow({
      where: { id: `solo:${round.id}` },
    });
    expect(archived.userId).toBeNull();
    expect(archived.sessionId).toBe(auth.id);
  });
});
