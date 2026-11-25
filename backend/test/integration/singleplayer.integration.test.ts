import './helpers/env.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { Prisma, PrismaClient } from '@prisma/client';
import { registerSingleplayerRoutes } from '../../src/modules/singleplayer/routes.js';
import { pendingStreetPrefetch } from '../../src/modules/singleplayer/prefetch.js';
import { createIntelligenceProvider } from '../../src/modules/intelligence/service.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { PanoramaError } from '../../src/modules/singleplayer/provider.js';
import { haversineKm } from '../../src/domain/distance.js';
import { scoreForDistance } from '../../src/domain/scoring.js';
import { createUserSession } from '../../src/modules/auth/service.js';
import { runMigrations } from './helpers/database.js';
import type { GeographicIntelligence } from '../../src/modules/intelligence/contract.js';
import type { IntelligenceLookup } from '../../src/modules/singleplayer/locationSelection.js';

/** A deterministic, always-valid weather payload (R03) — explicit provider
 * double so these tests never depend on real network access. */
function validIntelligence(): GeographicIntelligence {
  return {
    fetchedAt: new Date().toISOString(),
    cached: false,
    weather: {
      modelTime: new Date().toISOString(),
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
  it('reports diorama singleplayer as available out of the box without external map keys', async () => {
    const ready = Fastify();
    registerErrorHandler(ready);
    registerSingleplayerRoutes(ready, { db, intelligence });
    expect(
      (await ready.inject('/api/singleplayer/config')).json(),
    ).toEqual({
      available: true,
      provider: 'diorama',
      serverKeyConfigured: true,
    });
    const response = await ready.inject({
      method: 'POST',
      url: '/api/singleplayer/games',
    });
    expect(response.statusCode).toBe(201);
    ids.push(response.json().id);
    await ready.close();
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
        'rules',
        'scene',
        'selectedCandidateId',
        'selection',
        'startedAt',
        'submittedCandidateIds',
        'submittedGuesses',
      ]);
      expect(round).not.toHaveProperty('panoId');
      expect(round.scene).toMatchObject({
        biome: expect.any(String),
        weather: expect.any(String),
        lighting: expect.any(String),
        temperatureBand: expect.any(String),
        windBand: expect.any(String),
        seed: expect.any(Number),
      });
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
    await pendingStreetPrefetch(id, 2);
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
      locate: async (panoId) => {
        if (pauseLookup && panoId === 'retry-test-pano-0') {
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
      scene: expect.objectContaining({ biome: expect.any(String), seed: expect.any(Number) }),
      attemptsUsed: 0,
      attemptsTotal: 2,
    });
    const storedAfterRetry = await db.streetRound.findUniqueOrThrow({ where: { id: round.id } });
    expect(storedAfterRetry.panoId).not.toBe('retry-test-pano-0');
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
    expect(persisted.panoId).not.toBe('retry-test-pano-0');
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
  it('rejects an unrecognized difficulty value with 400 VALIDATION_ERROR', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/singleplayer/games',
      payload: { difficulty: 'expert' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });
  it('offers a 6-option candidate list without coordinates on easy and enforces choice membership (R04/R05)', async () => {
    const auth = await create('easy');
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    expect(round.candidates).toHaveLength(6);
    const ids = round.candidates.map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(6);
    // R04: coordinates are never sent to the client for Easy candidates.
    for (const candidate of round.candidates) {
      expect(Object.keys(candidate).sort()).toEqual(['id', 'name', 'region']);
    }
    // Reject arbitrary coordinates and forged candidate IDs in Easy mode.
    const rawSelection = await app.inject({
      method: 'PUT',
      url: `${auth.base}/rounds/${round.id}/selection`,
      headers: auth.headers,
      payload: { lat: 50, lon: 10 },
    });
    expect(rawSelection.statusCode).toBe(400);
    const forgedSelection = await app.inject({
      method: 'PUT',
      url: `${auth.base}/rounds/${round.id}/selection`,
      headers: auth.headers,
      payload: { candidateId: 'not-in-round' },
    });
    expect(forgedSelection.statusCode).toBe(400);
    const rawGuess = await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: 50, lon: 10, final: true },
    });
    expect(rawGuess.statusCode).toBe(400);
    const forgedGuess = await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { candidateId: 'not-in-round', final: true },
    });
    expect(forgedGuess.statusCode).toBe(400);

    // Valid candidate selection persists by candidateId without exposing coordinates.
    const pickedId = round.candidates[0].id as string;
    const saved = await app.inject({
      method: 'PUT',
      url: `${auth.base}/rounds/${round.id}/selection`,
      headers: auth.headers,
      payload: { candidateId: pickedId },
    });
    expect(saved.statusCode).toBe(204);

    // Resuming the session redisplays the same list and selectedCandidateId, never coordinates.
    const resumed = (await app.inject({ url: auth.base, headers: auth.headers })).json();
    expect(resumed.activeRound.candidates).toEqual(round.candidates);
    expect(resumed.activeRound.selection).toBeNull();
    expect(resumed.activeRound.selectedCandidateId).toBe(pickedId);
  });
  it('keeps an easy round open until the third attempt and returns no result early', async () => {
    const auth = await create('easy');
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const london = round.candidates.find((c: { name: string }) => c.name === 'London');
    expect(london).toBeDefined();
    const guess = () =>
      app.inject({
        method: 'POST',
        url: `${auth.base}/rounds/${round.id}/guess`,
        headers: auth.headers,
        payload: { candidateId: london.id },
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
    expect(third.result.score).toBeGreaterThan(0);
  });
  it('scores the closest submitted guess (Best-of-N) when time expires, ignoring unsubmitted moves (R08/R11)', async () => {
    const auth = await create('easy');
    const round = (await app.inject({
      method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers,
    })).json();
    expect(round.rules).toMatchObject({ selectionMode: 'list', attemptsPerRound: 3 });
    const storedRound = await db.streetRound.findUniqueOrThrow({ where: { id: round.id } });
    const storedCandidates = storedRound.candidatesJson as Array<{ id: string; lat: number; lon: number }>;
    const sortedByDist = [...storedCandidates].sort(
      (a, b) => haversineKm(a, { lat: 50, lon: 10 }) - haversineKm(b, { lat: 50, lon: 10 }),
    );
    const closer = sortedByDist[0]!;
    const farther = sortedByDist[sortedByDist.length - 1]!;
    const unsubmitted = sortedByDist[1]!;

    for (const choice of [closer, farther]) {
      const response = await app.inject({
        method: 'POST', url: `${auth.base}/rounds/${round.id}/guess`, headers: auth.headers,
        payload: { candidateId: choice.id },
      });
      expect(response.json().finalized).toBe(false);
    }
    const midSession = (await app.inject({ url: auth.base, headers: auth.headers })).json();
    expect(midSession.activeRound.submittedCandidateIds).toEqual([closer.id, farther.id]);
    expect(midSession.activeRound.submittedGuesses).toEqual([]);

    const selRes = await app.inject({
      method: 'PUT', url: `${auth.base}/rounds/${round.id}/selection`, headers: auth.headers,
      payload: { candidateId: unsubmitted.id },
    });
    expect(selRes.statusCode).toBe(204);
    await db.streetRound.update({ where: { id: round.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const session = (await app.inject({ url: auth.base, headers: auth.headers })).json();
    expect(session.activeRound).toBeNull();
    const expectedGuess = { lat: closer.lat, lon: closer.lon };
    expect(session.results[0]).toMatchObject({
      guess: expectedGuess,
      score: scoreForDistance(haversineKm(expectedGuess, { lat: 50, lon: 10 })),
    });
    expect(session.results[0].attempts).toHaveLength(2);
    expect(session.results[0].attempts[0]).toMatchObject({ attemptNumber: 1, guess: expectedGuess, isBest: true });
    expect(session.results[0].attempts[1]).toMatchObject({ attemptNumber: 2, isBest: false });
  });

  it('deducts the medium extra-data cost from the round score and withholds extra clues until unlocked', async () => {
    const auth = await create('medium');
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const beforeUnlock = (
      await app.inject({
        url: `${auth.base}/rounds/${round.id}/intelligence`,
        headers: auth.headers,
      })
    ).json();
    expect(beforeUnlock.weather).toMatchObject({
      temperatureC: 18,
      precipitationMm: 0,
      humidityPct: 40,
      windSpeedKmh: 10,
      condition: null,
      pressureHpa: null,
    });
    expect(beforeUnlock.environment).toMatchObject({
      elevationM: null,
      reliefM: null,
      terrain: null,
    });
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
    const afterUnlock = (
      await app.inject({
        url: `${auth.base}/rounds/${round.id}/intelligence`,
        headers: auth.headers,
      })
    ).json();
    expect(afterUnlock.weather).toMatchObject({
      condition: 'Clear sky',
      pressureHpa: 1013,
    });
    expect(afterUnlock.environment).toMatchObject({
      elevationM: 100,
      reliefM: 10,
      terrain: 'Low relief',
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
  const intelligence = vi.fn<IntelligenceLookup>(async () => ({
    ...validIntelligence(),
    weather: null,
  }));
  beforeAll(() => {
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db,
      provider,
      locate: async (panoId) => ({ lat: panoId === 'weather-pano-0' ? 50.001 : 50.002, lon: 10 }),
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
  it('validates and displays weather for the resolved panorama coordinates', async () => {
    const auth = await create();
    intelligence.mockImplementation(async (lat) =>
      lat === 50.002
        ? validIntelligence()
        : { ...validIntelligence(), weather: null },
    );
    try {
      const round = (
        await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
      ).json();
      expect(round.scene).toMatchObject({ biome: expect.any(String) });
      expect(await db.streetRound.count({ where: { panoId: 'weather-pano-0' } })).toBe(0);
      expect(await db.streetRound.count({ where: { panoId: 'weather-pano-1' } })).toBe(1);
      const clues = await app.inject({ url: `${auth.base}/rounds/${round.id}/intelligence`, headers: auth.headers });
      expect(clues.json().weather).toMatchObject({ temperatureC: 18 });
      expect(intelligence).toHaveBeenCalledWith(50.001, 10);
      expect(intelligence).toHaveBeenCalledWith(50.002, 10);
      await pendingStreetPrefetch(auth.id, 2);
    } finally {
      intelligence.mockImplementation(async () => ({
        ...validIntelligence(),
        weather: null,
      }));
    }
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
  const intelligence = vi.fn<IntelligenceLookup>(async (lat) => {
    const data = validIntelligence();
    if (lat === 12 && data.weather) data.weather.modelTime = '2000-01-01T00:00:00Z';
    return data;
  });
  beforeAll(() => {
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db,
      provider,
      locate: async (panoId) => panoId === 'stale-pano' ? { lat: 12, lon: 34 } : { lat: 50, lon: 10 },
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
    await pendingStreetPrefetch(auth.id, 2);
    // Seed a prepared record directly so we can verify round 2 consumes it without re-fetching.
    await db.streetGame.update({
      where: { id: auth.id },
      data: {
        nextRoundNumber: 2,
        nextTargetIndex: 99,
        nextPanoId: 'prefetched-pano',
        nextTargetLat: 12,
        nextTargetLon: 34,
        nextSceneJson: round.scene,
        nextWeatherValidUntil: new Date(Date.now() + 60 * 60_000),
        nextAttemptedIndices: [99],
        nextExhausted: false,
      },
    });
    await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: 50, lon: 10, final: true },
    });
    const startedAt = performance.now();
    const next = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const elapsedMs = performance.now() - startedAt;
    expect(next.scene).toMatchObject({ biome: expect.any(String) });
    expect(
      (await db.streetRound.findUniqueOrThrow({ where: { id: next.id } })).panoId,
    ).toBe('prefetched-pano');
    expect(elapsedMs).toBeLessThan(2000);
    await pendingStreetPrefetch(auth.id, 3);
    const game = await db.streetGame.findUniqueOrThrow({ where: { id: auth.id } });
    expect(game.nextPanoId).not.toBe('prefetched-pano');
  });
  it('replaces a prefetched target whose weather expired before the round started', async () => {
    const auth = await create();
    await db.streetGame.update({
      where: { id: auth.id },
      data: { nextTargetIndex: 5, nextPanoId: 'stale-pano', nextTargetLat: 50, nextTargetLon: 10 },
    });
    const response = await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers });
    expect(response.statusCode).toBe(200);
    expect(
      (await db.streetRound.findUniqueOrThrow({ where: { id: response.json().id } })).panoId,
    ).toBe('prefetch-pano-1');
    expect(provider).toHaveBeenCalledWith([5]);
    expect(intelligence).toHaveBeenCalledWith(12, 34);
    expect(intelligence).toHaveBeenCalledWith(50, 10);
    await pendingStreetPrefetch(auth.id, 2);
  });
  it('actually populates a prefetch in the background as soon as a round starts (R12)', async () => {
    const auth = await create();
    await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers });
    await pendingStreetPrefetch(auth.id, 2);
    const game = await db.streetGame.findUniqueOrThrow({ where: { id: auth.id } });
    expect(game.nextRoundNumber).toBe(2);
    expect(game.nextPanoId).not.toBeNull();
    expect(game.nextTargetIndex).not.toBeNull();
    expect(game.nextWeatherValidUntil).toBeInstanceOf(Date);
    expect(game.nextSceneJson).not.toBeNull();
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
    await pendingStreetPrefetch(auth.id, 7);
    const game = await db.streetGame.findUniqueOrThrow({ where: { id: auth.id } });
    expect(game.nextPanoId).not.toBeNull();
    expect(game.nextRoundNumber).toBe(7);
  });
  it('makes Next round playable well under 2 seconds even with 2.3s upstream forecasts (R12)', async () => {
    const slowApp = Fastify();
    registerErrorHandler(slowApp);
    const slowFetch = vi.fn(async (input: URL | RequestInfo) => {
      await new Promise((resolve) => setTimeout(resolve, 2300));
      const url = String(input);
      if (url.includes('/elevation')) {
        return new Response(JSON.stringify({ elevation: [40, 42, 45, 38, 40, 41, 39, 44, 43] }));
      }
      const iso = new Date(Date.now() - 60_000).toISOString().slice(0, 16);
      return new Response(
        JSON.stringify({
          current: {
            time: iso,
            interval: 900,
            temperature_2m: 19,
            weather_code: 1,
            relative_humidity_2m: 50,
            wind_speed_10m: 11,
            wind_direction_10m: 120,
            surface_pressure: 1015,
            precipitation: 0,
            is_day: 1,
          },
          current_units: {
            temperature_2m: '°C',
            relative_humidity_2m: '%',
            wind_speed_10m: 'km/h',
            wind_direction_10m: '°',
            surface_pressure: 'hPa',
            precipitation: 'mm',
          },
        }),
      );
    });
    const slowIntelligence = createIntelligenceProvider({
      fetcher: slowFetch as typeof fetch,
    });
    let nextIdx = 0;
    registerSingleplayerRoutes(slowApp, {
      db,
      provider: async () => {
        const idx = nextIdx++;
        return { panoId: `slow-pano-${idx}`, targetIndex: idx, lat: 40 + idx, lon: 10 + idx };
      },
      intelligence: slowIntelligence,
    });
    try {
      const created = (
        await slowApp.inject({ method: 'POST', url: '/api/singleplayer/games' })
      ).json();
      ids.push(created.id);
      const base = `/api/singleplayer/games/${created.id}`;
      const headers = { 'x-player-token': created.playerToken };

      const round1 = (
        await slowApp.inject({ method: 'POST', url: `${base}/rounds`, headers })
      ).json();
      // Round 2 prepares in the background while the player plays Round 1.
      await pendingStreetPrefetch(created.id, 2);

      await slowApp.inject({
        method: 'POST',
        url: `${base}/rounds/${round1.id}/guess`,
        headers,
        payload: { lat: 40, lon: 10, final: true },
      });

      const fetchesBeforeNext = slowFetch.mock.calls.length;
      const startedAt = performance.now();
      const round2Res = await slowApp.inject({
        method: 'POST',
        url: `${base}/rounds`,
        headers,
      });
      expect(round2Res.statusCode).toBe(200);
      const round2 = round2Res.json();
      const cluesRes = await slowApp.inject({
        url: `${base}/rounds/${round2.id}/intelligence`,
        headers,
      });
      const elapsedMs = performance.now() - startedAt;

      expect(cluesRes.statusCode).toBe(200);
      expect(cluesRes.json().weather).toMatchObject({ temperatureC: 19 });
      expect(elapsedMs).toBeLessThan(500);
      // Wait for Round 3 background prefetch to settle before closing.
      expect(slowFetch.mock.calls.length).toBeGreaterThanOrEqual(fetchesBeforeNext);
      await pendingStreetPrefetch(created.id, 3);
    } finally {
      await slowApp.close();
    }
  }, 15_000);
  it('joins an in-flight prefetch and caps distinct coordinates at 3 across failed prefetch + Next round (R12/R13)', async () => {
    const budgetApp = Fastify();
    registerErrorHandler(budgetApp);
    let failWeather = false;
    let releaseSecondLookup: (() => void) | undefined;
    let pauseSecondLookup = false;
    const fetchedCoords: string[] = [];
    let counter = 0;

    registerSingleplayerRoutes(budgetApp, {
      db,
      provider: async (used) => {
        while (used.includes(counter)) counter += 1;
        const idx = counter++;
        return { panoId: `budget-pano-${idx}`, targetIndex: idx, lat: 10 + idx, lon: 20 + idx };
      },
      intelligence: async (lat, lon) => {
        fetchedCoords.push(`${lat},${lon}`);
        if (pauseSecondLookup) {
          pauseSecondLookup = false;
          await new Promise<void>((resolve) => {
            releaseSecondLookup = resolve;
          });
        }
        return failWeather ? { ...validIntelligence(), weather: null } : validIntelligence();
      },
    });
    try {
      // 1) Concurrent in-flight prefetch join: zero duplicate lookups.
      const g1 = (await budgetApp.inject({ method: 'POST', url: '/api/singleplayer/games' })).json();
      ids.push(g1.id);
      const base1 = `/api/singleplayer/games/${g1.id}`;
      const headers1 = { 'x-player-token': g1.playerToken };
      const r1 = (await budgetApp.inject({ method: 'POST', url: `${base1}/rounds`, headers: headers1 })).json();
      await pendingStreetPrefetch(g1.id, 2);
      await budgetApp.inject({
        method: 'POST', url: `${base1}/rounds/${r1.id}/guess`, headers: headers1,
        payload: { lat: 10, lon: 20, final: true },
      });
      // Pause Round 3 prefetch while Round 2 starts, then immediately advance to Round 3.
      pauseSecondLookup = true;
      const r2 = (await budgetApp.inject({ method: 'POST', url: `${base1}/rounds`, headers: headers1 })).json();
      await budgetApp.inject({
        method: 'POST', url: `${base1}/rounds/${r2.id}/guess`, headers: headers1,
        payload: { lat: 11, lon: 21, final: true },
      });
      const coordsBeforeJoin = fetchedCoords.length;
      const r3Promise = budgetApp.inject({ method: 'POST', url: `${base1}/rounds`, headers: headers1 });
      await new Promise((resolve) => setTimeout(resolve, 25));
      releaseSecondLookup?.();
      const r3Res = await r3Promise;
      expect(r3Res.statusCode).toBe(200);
      // Only Round 4's subsequent prefetch (at most +1), no duplicate lookup for Round 3.
      await pendingStreetPrefetch(g1.id, 4);
      expect(new Set(fetchedCoords.slice(coordsBeforeJoin)).size).toBeLessThanOrEqual(1);

      // 2) Failed prefetch (3 distinct locations) + Next round must NOT fetch 3 more (max 3 total, not 6).
      const g2 = (await budgetApp.inject({ method: 'POST', url: '/api/singleplayer/games' })).json();
      ids.push(g2.id);
      const base2 = `/api/singleplayer/games/${g2.id}`;
      const headers2 = { 'x-player-token': g2.playerToken };
      fetchedCoords.length = 0;
      const roundOne = (await budgetApp.inject({ method: 'POST', url: `${base2}/rounds`, headers: headers2 })).json();
      await pendingStreetPrefetch(g2.id, 2);
      await budgetApp.inject({
        method: 'POST', url: `${base2}/rounds/${roundOne.id}/guess`, headers: headers2,
        payload: { lat: 10, lon: 20, final: true },
      });
      // Force Round 2 to prepare from scratch while weather is failing everywhere.
      await db.streetGame.update({
        where: { id: g2.id },
        data: {
          nextRoundNumber: null,
          nextTargetIndex: null,
          nextPanoId: null,
          nextTargetLat: null,
          nextTargetLon: null,
          nextSceneJson: Prisma.DbNull,
          nextWeatherValidUntil: null,
          nextAttemptedIndices: [],
          nextExhausted: false,
        },
      });
      fetchedCoords.length = 0;
      failWeather = true;
      // Trigger background prefetch (as finalizeRound/startRound does), let it exhaust 3 locations.
      const { prefetchNextStreetRound } = await import('../../src/modules/singleplayer/prefetch.js');
      await prefetchNextStreetRound(
        g2.id,
        2,
        db,
        async (used) => {
          while (used.includes(counter)) counter += 1;
          const idx = counter++;
          return { panoId: `budget-pano-${idx}`, targetIndex: idx, lat: 10 + idx, lon: 20 + idx };
        },
        async (lat, lon) => {
          fetchedCoords.push(`${lat},${lon}`);
          return { ...validIntelligence(), weather: null };
        },
      );
      expect(new Set(fetchedCoords).size).toBe(3);

      // Now Next round arrives: must return 503 with ZERO additional coordinates fetched!
      const failedNext = await budgetApp.inject({ method: 'POST', url: `${base2}/rounds`, headers: headers2 });
      expect(failedNext.statusCode).toBe(503);
      expect(failedNext.json().error.code).toBe('WEATHER_UNAVAILABLE');
      expect(new Set(fetchedCoords).size).toBe(3);

      // Explicit manual retry after the 503 error screen recovers once weather returns.
      failWeather = false;
      const recovered = await budgetApp.inject({ method: 'POST', url: `${base2}/rounds`, headers: headers2 });
      expect(recovered.statusCode).toBe(200);
      await pendingStreetPrefetch(g2.id, 3);
    } finally {
      await budgetApp.close();
    }
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
  it('evaluates and archives the closest submitted attempt (Best-of-N) even when a later Final Submit is farther (R02/R11/R18)', async () => {
    const account = await signIn(db, 'Archive Best Guess');
    userIds.push(account.user.id);
    const auth = await createGame('medium', account.cookie);
    const round = (
      await app.inject({ method: 'POST', url: `${auth.base}/rounds`, headers: auth.headers })
    ).json();
    const first = await app.inject({
      method: 'POST',
      url: `${auth.base}/rounds/${round.id}/guess`,
      headers: auth.headers,
      payload: { lat: 48, lon: 11 },
    });
    expect(first.json()).toMatchObject({ finalized: false, attemptsRemaining: 1 });
    const midSession = (await app.inject({ url: auth.base, headers: auth.headers })).json();
    expect(midSession.activeRound.submittedGuesses).toEqual([{ lat: 48, lon: 11 }]);

    const second = (
      await app.inject({
        method: 'POST',
        url: `${auth.base}/rounds/${round.id}/guess`,
        headers: auth.headers,
        payload: { lat: 0, lon: 0, final: true },
      })
    ).json();
    expect(second.finalized).toBe(true);
    expect(second.result.guess).toEqual({ lat: 48, lon: 11 });
    expect(second.result.attempts).toHaveLength(2);
    expect(second.result.attempts[0]).toMatchObject({ attemptNumber: 1, guess: { lat: 48, lon: 11 }, isBest: true });
    expect(second.result.attempts[1]).toMatchObject({ attemptNumber: 2, guess: { lat: 0, lon: 0 }, isBest: false });

    const archived = await db.gameResult.findUniqueOrThrow({
      where: { id: `solo:${round.id}` },
    });
    expect(archived.guessLat).toBe(48);
    expect(archived.guessLon).toBe(11);
    expect(archived.score).toBe(second.result.score);
    expect(archived.distanceKm).toBe(second.result.distanceKm);
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
    expect(await db.gameResult.findUnique({ where: { id: `solo:${round.id}` } })).toMatchObject({
      userId: null,
      sessionId: auth.id,
    });
  });
  it('preserves placeName on pre-diorama legacy results (index 2 Rome) instead of showing Berlin (R11)', async () => {
    const auth = await createGame('medium');
    await db.streetRound.create({
      data: {
        gameId: auth.id,
        number: 1,
        panoId: 'legacy-rome-pano',
        targetIndex: 2, // Pre-diorama index 2 = Rome; current index 2 = Berlin
        targetLat: 41.8902,
        targetLon: 12.4923,
        sceneJson: Prisma.DbNull,
        placeName: null,
        guessLat: 41.9,
        guessLon: 12.5,
        distanceKm: 1.2,
        score: 5000,
      },
    });
    const session = (
      await app.inject({ url: auth.base, headers: auth.headers })
    ).json();
    expect(session.results).toHaveLength(1);
    expect(session.results[0]).toMatchObject({
      actual: { lat: 50.25, lon: 10.25 }, // test locate overrides coordinates in this suite
    });

    // Verify with a service without custom locate override (production diorama path).
    const prodApp = Fastify();
    registerErrorHandler(prodApp);
    registerSingleplayerRoutes(prodApp, {
      db,
      intelligence: async () => validIntelligence(),
    });
    try {
      const prodSession = (
        await prodApp.inject({ url: auth.base, headers: auth.headers })
      ).json();
      expect(prodSession.results[0]).toMatchObject({
        actual: { lat: 41.8902, lon: 12.4923 },
        placeName: 'Rome',
      });
    } finally {
      await prodApp.close();
    }
  });
});
