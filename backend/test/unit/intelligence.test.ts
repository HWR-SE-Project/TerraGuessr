import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createIntelligenceProvider } from '../../src/modules/intelligence/service.js';
import { registerSingleplayerRoutes } from '../../src/modules/singleplayer/routes.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { hashPlayerToken } from '../../src/plugins/auth.js';

const current = {
  time: '2026-11-19T12:00',
  interval: 900,
  temperature_2m: 12.3,
  weather_code: 2,
  relative_humidity_2m: 64,
  wind_speed_10m: 8,
  wind_direction_10m: 240,
  surface_pressure: 1003.4,
  precipitation: 0,
};
const current_units = {
  temperature_2m: '°C',
  relative_humidity_2m: '%',
  wind_speed_10m: 'km/h',
  wind_direction_10m: '°',
  surface_pressure: 'hPa',
  precipitation: 'mm',
};
const sample = () => ({
  fetchedAt: '2026-11-19T12:01:00Z',
  cached: false,
  weather: null,
  environment: {
    elevationM: 100,
    reliefM: 20,
    terrain: 'Low relief' as const,
    biome: null,
    vegetation: null,
  },
  climate: null,
});

describe('environment provider boundary', () => {
  it('projects real metrics, deduplicates requests, expires weather separately and caches elevation', async () => {
    let now = Date.parse('2026-11-19T12:01Z');
    const fetcher = vi.fn(
      async (input: URL | RequestInfo) =>
        new Response(
          JSON.stringify(
            String(input).includes('/elevation')
              ? { elevation: [100, 101, 102, 103, 90, 95, 100, 103, 110] }
              : {
                  current,
                  current_units,
                  latitude: 50,
                  longitude: 10,
                  timezone: 'spoiler',
                  city: 'spoiler',
                },
          ),
        ),
    );
    const get = createIntelligenceProvider({
      fetcher: fetcher as typeof fetch,
      now: () => now,
    });
    const [first, simultaneous] = await Promise.all([get(50, 10), get(50, 10)]);
    expect(first).toEqual(simultaneous);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(first.weather).toMatchObject({
      condition: 'Partly cloudy',
      temperatureC: 12.3,
      precipitationMm: 0,
      precipitationIntervalMinutes: 15,
      modelTime: '2026-11-19T12:00Z',
    });
    expect(first.environment).toMatchObject({
      elevationM: 100,
      reliefM: 20,
      terrain: 'Low relief',
    });
    expect(JSON.stringify(first)).not.toMatch(
      /latitude|longitude|timezone|spoiler/,
    );
    expect((await get(50, 10)).cached).toBe(true);
    now += 16 * 60_000;
    expect((await get(50, 10)).cached).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(String(fetcher.mock.calls[2]![0])).toContain('/forecast');
  });
  it('keeps elevation during weather outages, rejects bogus units and values, and never infers biome or climate', async () => {
    const get = createIntelligenceProvider({
      now: () => Date.parse('2026-11-19T12:01Z'),
      fetcher: vi.fn(async (input) => {
        if (String(input).includes('/elevation'))
          return new Response(JSON.stringify({ elevation: [0] }));
        return new Response(
          JSON.stringify({
            current: {
              ...current,
              relative_humidity_2m: 999,
              weather_code: 'city name',
              temperature_2m: null,
            },
            current_units: { ...current_units, surface_pressure: 'Pa' },
          }),
        );
      }) as typeof fetch,
    });
    const value = await get(0, 0);
    expect(value.weather).toMatchObject({
      humidityPct: null,
      temperatureC: null,
      condition: null,
      pressureHpa: null,
    });
    expect(value.environment).toMatchObject({
      elevationM: 0,
      terrain: null,
      biome: null,
      vegetation: null,
    });
    expect(value.climate).toBeNull();
  });
  it('uses a short negative cache after outages and recovers without stale or fictional values', async () => {
    let now = 0;
    const fetcher = vi.fn(async () => {
      throw new Error('provider secret city coords');
    });
    const get = createIntelligenceProvider({ fetcher, now: () => now });
    const failed = await get(50, 10);
    expect(failed.weather).toBeNull();
    expect(failed.environment.elevationM).toBeNull();
    await get(50, 10);
    expect(fetcher).toHaveBeenCalledTimes(2);
    now = 31_000;
    await get(50, 10);
    expect(fetcher).toHaveBeenCalledTimes(4);
    await expect(get(NaN, 10)).rejects.toThrow('Invalid server location');
  });
  it('rejects a weather model timestamp older than 120 minutes at display time', async () => {
    const fetcher = vi.fn(
      async (input: URL | RequestInfo) =>
        new Response(
          JSON.stringify(
            String(input).includes('/elevation')
              ? { elevation: [100] }
              : { current, current_units },
          ),
        ),
    );
    const get = createIntelligenceProvider({
      fetcher: fetcher as typeof fetch,
      now: () => Date.parse('2026-11-19T14:01Z'),
    });
    const value = await get(50, 10);
    expect(value.weather).toBeNull();
  });
  it('rejects cached weather that crosses the 120-minute limit while cached', async () => {
    const aged = { ...current, time: '2026-11-19T11:00' };
    let now = Date.parse('2026-11-19T12:50Z');
    const fetcher = vi.fn(
      async (input: URL | RequestInfo) =>
        new Response(
          JSON.stringify(
            String(input).includes('/elevation')
              ? { elevation: [100] }
              : { current: aged, current_units },
          ),
        ),
    );
    const get = createIntelligenceProvider({
      fetcher: fetcher as typeof fetch,
      now: () => now,
    });
    const fresh = await get(50, 10);
    expect(fresh.weather?.temperatureC).toBe(12.3);
    expect(fresh.cached).toBe(false);
    now = Date.parse('2026-11-19T13:01Z');
    const stale = await get(50, 10);
    expect(stale.weather).toBeNull();
    expect(stale.cached).toBe(false);
  });
  it('rejects weather without a model timestamp even when metrics are present', async () => {
    const { time: _time, ...withoutTime } = current;
    const fetcher = vi.fn(
      async (input: URL | RequestInfo) =>
        new Response(
          JSON.stringify(
            String(input).includes('/elevation')
              ? { elevation: [100] }
              : { current: withoutTime, current_units },
          ),
        ),
    );
    const get = createIntelligenceProvider({
      fetcher: fetcher as typeof fetch,
      now: () => Date.parse('2026-11-19T12:01Z'),
    });
    const value = await get(50, 10);
    expect(value.weather).toBeNull();
  });
});

describe('intelligence HTTP privacy and ownership (database double)', () => {
  async function fixture() {
    const round = {
      id: 'round',
      gameId: 'game',
      score: null as number | null,
      panoId: 'starting-pano',
      additionalDataUnlockedAt: null as Date | null,
      additionalDataPointsSpent: 0,
    };
    const game = {
      id: 'game',
      difficulty: 'easy' as 'easy' | 'medium' | 'hard',
      playerTokenHash: hashPlayerToken('owner'),
      expiresAt: new Date(Date.now() + 60_000),
      rounds: [round],
    };
    const db = {
      streetGame: { findUnique: vi.fn(async () => game) },
      streetRound: { findUnique: vi.fn(async () => round) },
    };
    const locate = vi.fn(async () => ({ lat: 50.123, lon: 10.456 }));
    const intelligence = vi.fn(async () => ({
      ...sample(),
      latitude: 50.123,
      city: 'SECRET',
      environment: { ...sample().environment, country: 'SECRET' },
    }));
    const app = Fastify();
    registerErrorHandler(app);
    registerSingleplayerRoutes(app, {
      db: db as unknown as PrismaClient,
      locate,
      intelligence,
    });
    return {
      app,
      game,
      round,
      intelligence,
      locate,
      url: '/api/singleplayer/games/game/rounds/round/intelligence',
      headers: { 'x-player-token': 'owner' },
    };
  }
  it('requires ownership, active round and valid session before touching providers', async () => {
    const f = await fixture();
    try {
      for (const headers of [{}, { 'x-player-token': 'wrong' }])
        expect((await f.app.inject({ url: f.url, headers })).statusCode).toBe(
          404,
        );
      expect(
        (
          await f.app.inject({
            url: f.url.replace('/round/', '/foreign/'),
            headers: f.headers,
          })
        ).statusCode,
      ).toBe(404);
      f.round.score = 100;
      expect(
        (await f.app.inject({ url: f.url, headers: f.headers })).statusCode,
      ).toBe(409);
      f.round.score = null;
      f.game.expiresAt = new Date(0);
      expect(
        (await f.app.inject({ url: f.url, headers: f.headers })).statusCode,
      ).toBe(404);
      expect(f.locate).not.toHaveBeenCalled();
    } finally {
      await f.app.close();
    }
  });
  it('uses the server panorama and strips unexpected fields at every level', async () => {
    const f = await fixture();
    try {
      const res = await f.app.inject({
        url: f.url + '?lat=0&lon=0',
        headers: f.headers,
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.json()).toEqual(sample());
      expect(f.locate).toHaveBeenCalledWith('starting-pano');
      expect(f.intelligence).toHaveBeenCalledWith(50.123, 10.456);
    } finally {
      await f.app.close();
    }
  });
  it('withholds locked extra clues on medium/hard until unlocked, while keeping core weather (R05)', async () => {
    const f = await fixture();
    f.game.difficulty = 'medium';
    f.intelligence.mockResolvedValue({
      fetchedAt: '2026-11-19T12:01:00Z',
      cached: false,
      weather: {
        modelTime: new Date().toISOString(),
        temperatureC: 12.3,
        condition: 'Partly cloudy',
        windSpeedKmh: 8,
        windDirectionDeg: 240,
        humidityPct: 64,
        pressureHpa: 1003.4,
        precipitationMm: 0,
        precipitationIntervalMinutes: 15,
      },
      environment: {
        elevationM: 420,
        reliefM: 85,
        terrain: 'Rolling relief',
        biome: null,
        vegetation: null,
      },
      climate: null,
    });
    try {
      const locked = (
        await f.app.inject({ url: f.url, headers: f.headers })
      ).json();
      expect(locked.weather).toMatchObject({
        temperatureC: 12.3,
        precipitationMm: 0,
        humidityPct: 64,
        windSpeedKmh: 8,
        condition: null,
        pressureHpa: null,
      });
      expect(locked.environment).toMatchObject({
        elevationM: null,
        reliefM: null,
        terrain: null,
      });

      f.round.additionalDataUnlockedAt = new Date();
      const unlocked = (
        await f.app.inject({ url: f.url, headers: f.headers })
      ).json();
      expect(unlocked.weather).toMatchObject({
        condition: 'Partly cloudy',
        pressureHpa: 1003.4,
      });
      expect(unlocked.environment).toMatchObject({
        elevationM: 420,
        reliefM: 85,
        terrain: 'Rolling relief',
      });
    } finally {
      await f.app.close();
    }
  });
  it('discards a response if the round changes during provider retrieval', async () => {
    const f = await fixture();
    f.intelligence.mockImplementationOnce(async () => {
      f.round.panoId = 'replacement';
      return {
        ...sample(),
        latitude: 1,
        city: 'SECRET',
        environment: { ...sample().environment, country: 'SECRET' },
      };
    });
    // Return a snapshot as a database query would, not the mutable fake object.
    f.game.rounds = [{ ...f.round }];
    try {
      expect(
        (await f.app.inject({ url: f.url, headers: f.headers })).statusCode,
      ).toBe(409);
    } finally {
      await f.app.close();
    }
  });
});
