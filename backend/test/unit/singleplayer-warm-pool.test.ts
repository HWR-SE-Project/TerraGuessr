import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { createRoundWarmPool } from '../../src/modules/singleplayer/warmPool.js';
import { createSingleplayerService } from '../../src/modules/singleplayer/service.js';
import { registerSingleplayerRoutes } from '../../src/modules/singleplayer/routes.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import type { GeographicIntelligence } from '../../src/modules/intelligence/contract.js';
import type { PanoramaTarget } from '../../src/modules/singleplayer/provider.js';

function makeTarget(index: number): PanoramaTarget {
  return {
    panoId: `loc:${index}`,
    targetIndex: index,
    lat: 50 + index * 0.1,
    lon: 10 + index * 0.1,
    biome: 'urban',
    placeName: `Place ${index}`,
  };
}

function validWeather(modelTimeMs = Date.now()): GeographicIntelligence {
  return {
    fetchedAt: new Date(modelTimeMs).toISOString(),
    cached: false,
    weather: {
      modelTime: new Date(modelTimeMs).toISOString(),
      temperatureC: 16,
      condition: 'Clear sky',
      windSpeedKmh: 8,
      windDirectionDeg: 180,
      humidityPct: 55,
      pressureHpa: 1015,
      precipitationMm: 0,
      precipitationIntervalMinutes: 15,
    },
    environment: {
      elevationM: null,
      reliefM: null,
      terrain: null,
      biome: null,
      vegetation: null,
    },
    climate: null,
  };
}

describe('RoundWarmPool', () => {
  it('pre-fills distinct Round 1 entries, serves them in FIFO order without extra lookups, and refills after take()', async () => {
    let nextIndex = 0;
    const provider = vi.fn(async (used: number[]) => {
      while (used.includes(nextIndex)) nextIndex += 1;
      const chosen = nextIndex;
      nextIndex += 1;
      return makeTarget(chosen);
    });
    const intelligence = vi.fn(async () => validWeather());

    const pool = createRoundWarmPool({
      provider,
      intelligence,
      maxSize: 2,
    });

    expect(pool.size()).toBe(0);
    await pool.warmUp();
    expect(pool.size()).toBe(2);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(intelligence).toHaveBeenCalledTimes(2);

    const first = await pool.take();
    expect(first?.target.targetIndex).toBe(0);

    // Wait a tick for background refill triggered by take().
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pool.size()).toBe(2);
    expect(provider).toHaveBeenCalledTimes(3);

    const second = await pool.take();
    expect(second?.target.targetIndex).toBe(1);
    expect(second?.target.targetIndex).not.toBe(first?.target.targetIndex);
  });

  it('prunes expired entries instead of returning stale weather', async () => {
    let currentTime = Date.parse('2026-11-26T12:00:00.000Z');
    const provider = vi.fn(async (used: number[]) => makeTarget(used.length));
    const intelligence = vi.fn(async () => validWeather(currentTime));

    const pool = createRoundWarmPool({
      provider,
      intelligence,
      maxSize: 1,
      maxEntryAgeMs: 10 * 60_000,
      now: () => currentTime,
    });

    await pool.warmUp();
    expect(pool.size()).toBe(1);

    // Advance past maxEntryAgeMs.
    currentTime += 11 * 60_000;
    expect(pool.size()).toBe(0);
    expect(await pool.take()).toBeNull();
  });

  it('joins an in-flight warmUp fetch when take() is called before fill completes', async () => {
    let resolveWeather!: (value: GeographicIntelligence) => void;
    const provider = vi.fn(async () => makeTarget(7));
    const intelligence = vi
      .fn<() => Promise<GeographicIntelligence>>()
      .mockImplementationOnce(
        () =>
          new Promise<GeographicIntelligence>((resolve) => {
            resolveWeather = resolve;
          }),
      )
      .mockImplementation(async () => validWeather());

    const pool = createRoundWarmPool({
      provider,
      intelligence,
      maxSize: 1,
    });

    const warmPromise = pool.warmUp();
    const takePromise = pool.take();

    // Yield microtasks so warmUp reaches intelligence().
    await Promise.resolve();
    await Promise.resolve();
    resolveWeather(validWeather());

    const entry = await takePromise;
    await warmPromise;

    expect(entry?.target.targetIndex).toBe(7);
    // Joined the in-flight warmUp call without duplicating it; background refill
    // then replenishes the pool asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pool.size()).toBe(1);
    expect(intelligence).toHaveBeenCalledTimes(2);
  });

  it('backs off cleanly when upstream weather is unavailable', async () => {
    let currentTime = Date.parse('2026-11-26T12:00:00.000Z');
    const provider = vi.fn(async (used: number[]) => makeTarget(used.length));
    const intelligence = vi.fn(async () => ({
      ...validWeather(currentTime),
      weather: null,
    }));

    const pool = createRoundWarmPool({
      provider,
      intelligence,
      maxSize: 2,
      failureCooldownMs: 30_000,
      now: () => currentTime,
    });

    await pool.warmUp();
    expect(pool.size()).toBe(0);
    expect(provider).toHaveBeenCalledTimes(3); // R13 3-location attempt cap

    // Immediate second warmUp should respect cooldown and issue zero calls.
    await pool.warmUp();
    expect(provider).toHaveBeenCalledTimes(3);

    // After cooldown expires, warming retries cleanly.
    currentTime += 31_000;
    await pool.warmUp();
    expect(provider).toHaveBeenCalledTimes(6);
  });
});

describe('singleplayer single-hop startFirstRound & warm endpoint', () => {
  it('createGame with startFirstRound=true consumes the warm pool and returns the initial session', async () => {
    let nextIndex = 0;
    const provider = vi.fn(async (used: number[]) => {
      while (used.includes(nextIndex)) nextIndex += 1;
      const chosen = nextIndex;
      nextIndex += 1;
      return makeTarget(chosen);
    });
    const intelligence = vi.fn(async () => validWeather());
    const createdRound = {
      id: 'round-1',
      gameId: 'game-warm-1',
      number: 1,
      panoId: 'loc:0',
      targetIndex: 0,
      targetLat: 50,
      targetLon: 10,
      placeName: 'Place 0',
      sceneJson: {
        biome: 'urban',
        weather: 'clear',
        lighting: 'day',
        temperatureBand: 'mild',
        windBand: 'calm',
        seed: 123,
      },
      candidatesJson: null,
      startedAt: new Date(),
      endsAt: new Date(Date.now() + 240_000),
      selectionLat: null,
      selectionLon: null,
      additionalDataUnlockedAt: null,
      additionalDataPointsSpent: 0,
      guessLat: null,
      guessLon: null,
      distanceKm: null,
      score: null,
      createdAt: new Date(),
      attempts: [],
    };
    const db = {
      streetGame: {
        create: vi.fn().mockResolvedValue({ id: 'game-warm-1' }),
        deleteMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null), // background Round 2 prefetch no-op
      },
      streetRound: {
        create: vi.fn().mockResolvedValue(createdRound),
      },
    } as unknown as PrismaClient;

    const service = createSingleplayerService({ db, provider, intelligence });
    await service.warmUp();
    const callsAfterWarm = intelligence.mock.calls.length;

    const created = await service.createGame({
      difficulty: 'medium',
      roundsTotal: 5,
      ownerUserId: null,
      startFirstRound: true,
    });

    expect(created.id).toBe('game-warm-1');
    expect(created.session).toBeDefined();
    expect(created.session?.difficulty).toBe('medium');
    expect(created.session?.roundsTotal).toBe(5);
    expect(created.session?.activeRound?.id).toBe('round-1');
    expect(created.session?.activeRound?.number).toBe(1);
    expect(created.session?.results).toEqual([]);
    // No synchronous weather call needed during createGame because pool was warm.
    expect(intelligence.mock.calls.length).toBeGreaterThanOrEqual(callsAfterWarm);
    expect(db.streetGame.deleteMany).not.toHaveBeenCalled();
  });

  it('cleans up the newly created StreetGame row if startFirstRound weather lookup fails', async () => {
    const provider = vi.fn(async (used: number[]) => makeTarget(used.length));
    const intelligence = vi.fn(async () => ({ ...validWeather(), weather: null }));
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      streetGame: {
        create: vi.fn().mockResolvedValue({ id: 'game-fail-1' }),
        deleteMany,
      },
    } as unknown as PrismaClient;

    const service = createSingleplayerService({ db, provider, intelligence });
    await expect(
      service.createGame({
        difficulty: 'medium',
        roundsTotal: 5,
        ownerUserId: null,
        startFirstRound: true,
      }),
    ).rejects.toMatchObject({ code: 'WEATHER_UNAVAILABLE' });

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'game-fail-1' } });
  });

  it('POST /api/singleplayer/warm returns 204 and primes the warm pool', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    const warmPool = {
      warmUp: vi.fn().mockResolvedValue(undefined),
      take: vi.fn().mockResolvedValue(null),
      size: vi.fn().mockReturnValue(0),
    };
    registerSingleplayerRoutes(app, { warmPool });

    const res = await app.inject({
      method: 'POST',
      url: '/api/singleplayer/warm',
    });

    expect(res.statusCode).toBe(204);
    expect(warmPool.warmUp).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
