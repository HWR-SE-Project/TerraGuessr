import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createIntelligenceProvider } from '../../src/modules/intelligence/service.js';
import { registerSingleplayerRoutes } from '../../src/modules/singleplayer/routes.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { hashPlayerToken } from '../../src/plugins/auth.js';

const MET_NO_UNITS = {
  air_pressure_at_sea_level: 'hPa',
  air_temperature: 'celsius',
  air_temperature_max: 'celsius',
  air_temperature_min: 'celsius',
  cloud_area_fraction: '%',
  cloud_area_fraction_high: '%',
  cloud_area_fraction_low: '%',
  cloud_area_fraction_medium: '%',
  dew_point_temperature: 'celsius',
  fog_area_fraction: '%',
  precipitation_amount: 'mm',
  probability_of_precipitation: '%',
  probability_of_thunder: '%',
  relative_humidity: '%',
  ultraviolet_index_clear_sky: '1',
  wind_from_direction: 'degrees',
  wind_speed: 'm/s',
  wind_speed_of_gust: 'm/s',
};

function metNoResponse(
  baseIso = '2026-11-19T12:00:00Z',
  options: {
    hours?: number;
    altitudeM?: number;
    detailsOverride?: Record<string, unknown>;
    unitsOverride?: Record<string, unknown>;
    symbolCode?: string;
    expiresHeader?: string;
  } = {},
) {
  const baseMs = Date.parse(baseIso);
  const hours = options.hours ?? 24;
  const timeseries = [];
  for (let h = 0; h <= hours; h += 1) {
    const time = new Date(baseMs + h * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const temp = h === 0 ? 12.3 : h === 6 ? 18.5 : h === 15 ? 4.2 : 11.0;
    const uv = h === 0 ? 1.4 : h === 3 ? 6.8 : 0.0;
    timeseries.push({
      time,
      data: {
        instant: {
          details: {
            air_pressure_at_sea_level: 1011.5,
            air_temperature: temp,
            cloud_area_fraction: 58.2,
            cloud_area_fraction_low: 25.0,
            cloud_area_fraction_medium: 30.0,
            cloud_area_fraction_high: 15.0,
            dew_point_temperature: 6.4,
            fog_area_fraction: 5.0,
            relative_humidity: 64,
            ultraviolet_index_clear_sky: uv,
            wind_from_direction: 240,
            wind_speed: 5,
            wind_speed_of_gust: 8.5,
            ...(h === 0 ? options.detailsOverride : {}),
          },
        },
        next_1_hours: {
          summary: { symbol_code: options.symbolCode ?? 'partlycloudy_day' },
          details: {
            precipitation_amount: h === 0 ? 0.5 : 0.2,
            probability_of_thunder: h === 0 ? 15 : 0,
          },
        },
        next_6_hours: {
          summary: { symbol_code: options.symbolCode ?? 'partlycloudy_day' },
          details: {
            air_temperature_max: 19.1,
            air_temperature_min: 3.8,
            precipitation_amount: 1.5,
          },
        },
      },
    });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.expiresHeader) headers.Expires = options.expiresHeader;

  return new Response(
    JSON.stringify({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [10.7522, 59.9139, options.altitudeM ?? 142],
      },
      properties: {
        meta: {
          updated_at: baseIso,
          units: { ...MET_NO_UNITS, ...options.unitsOverride },
        },
        timeseries,
      },
      timezone: 'spoiler',
      city: 'spoiler',
    }),
    { headers },
  );
}

const sample = () => ({
  fetchedAt: '2026-11-19T12:01:00Z',
  cached: false,
  weather: null,
  environment: {
    elevationM: 142,
    reliefM: null,
    terrain: null,
    biome: null,
    vegetation: null,
  },
  climate: null,
});

describe('MET Norway intelligence provider boundary', () => {
  it('extracts complete metrics, 24h rollups, and elevation in one call, deduplicates, and honors Expires', async () => {
    let now = Date.parse('2026-11-19T12:05:00Z');
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain('api.met.no/weatherapi/locationforecast/2.0/complete');
      expect(url).toContain('lat=59.9139');
      expect(url).toContain('lon=10.7522');
      expect((init?.headers as Record<string, string>)['User-Agent']).toContain('TerraGuessr');
      return metNoResponse('2026-11-19T12:00:00Z', {
        expiresHeader: 'Thu, 19 Nov 2026 12:35:00 GMT',
      });
    });

    const get = createIntelligenceProvider({
      baseUrl: 'https://api.met.no',
      userAgent: 'TerraGuessr/0.1 (+https://terra-guessr.vercel.app)',
      fetcher: fetcher as typeof fetch,
      now: () => now,
    });

    const [first, simultaneous] = await Promise.all([
      get(59.91391, 10.75224),
      get(59.91392, 10.75221),
    ]);
    expect(first).toEqual(simultaneous);
    expect(fetcher).toHaveBeenCalledTimes(1);

    expect(first.weather).toEqual({
      modelTime: '2026-11-19T12:00:00Z',
      temperatureC: 12.3,
      condition: 'Partly cloudy',
      windSpeedKmh: 18,
      windDirectionDeg: 240,
      humidityPct: 64,
      pressureHpa: 1011.5,
      precipitationMm: 0.5,
      precipitationIntervalMinutes: 60,
      isDay: true,
      dewPointC: 6.4,
      cloudCoverPct: 58.2,
      cloudLowPct: 25,
      cloudMediumPct: 30,
      cloudHighPct: 15,
      fogPct: 5,
      windGustKmh: 30.6,
      uvIndex: 1.4,
      uvIndexMax24h: 6.8,
      tempMin24hC: 3.8,
      tempMax24hC: 19.1,
      precipitation24hMm: 5.1,
      thunderProbabilityPct: 15,
    });
    expect(first.environment).toEqual({
      elevationM: 142,
      reliefM: null,
      terrain: null,
      biome: null,
      vegetation: null,
    });
    expect(JSON.stringify(first)).not.toMatch(/latitude|longitude|timezone|spoiler/);

    // Still cached at +20m because Expires was +30m.
    now += 20 * 60_000;
    expect((await get(59.9139, 10.7522)).cached).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Refetches once past Expires (+31m total).
    now += 11 * 60_000;
    expect((await get(59.9139, 10.7522)).cached).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects bogus units and out-of-range values without inferring biome or climate', async () => {
    const get = createIntelligenceProvider({
      now: () => Date.parse('2026-11-19T12:01:00Z'),
      fetcher: vi.fn(async () =>
        metNoResponse('2026-11-19T12:00:00Z', {
          hours: 0,
          altitudeM: 0,
          detailsOverride: {
            relative_humidity: 999,
            air_temperature: null,
            dew_point_temperature: 250,
            ultraviolet_index_clear_sky: -4,
          },
          unitsOverride: {
            air_pressure_at_sea_level: 'Pa',
            cloud_area_fraction: 'fraction',
          },
          symbolCode: 'unknown_city_name',
        }),
      ) as typeof fetch,
    });

    const value = await get(0, 0);
    expect(value.weather).toMatchObject({
      humidityPct: null,
      temperatureC: null,
      condition: null,
      pressureHpa: null,
      dewPointC: null,
      cloudCoverPct: null,
      uvIndex: null,
      uvIndexMax24h: null,
      tempMin24hC: null,
      tempMax24hC: null,
      precipitation24hMm: null,
    });
    expect(value.environment).toEqual({
      elevationM: 0,
      reliefM: null,
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
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 31_000;
    await get(50, 10);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(get(NaN, 10)).rejects.toThrow('Invalid server location');
  });

  it('rejects a weather model timestamp older than 120 minutes at display time', async () => {
    const fetcher = vi.fn(async () => metNoResponse('2026-11-19T12:00:00Z', { hours: 0 }));
    const get = createIntelligenceProvider({
      fetcher: fetcher as typeof fetch,
      now: () => Date.parse('2026-11-19T14:01:00Z'),
    });
    const value = await get(50, 10);
    expect(value.weather).toBeNull();
  });

  it('rejects cached weather that crosses the 120-minute limit while cached', async () => {
    let now = Date.parse('2026-11-19T12:50:00Z');
    const fetcher = vi.fn(async () => metNoResponse('2026-11-19T11:00:00Z', { hours: 0 }));
    const get = createIntelligenceProvider({
      fetcher: fetcher as typeof fetch,
      now: () => now,
    });
    const fresh = await get(50, 10);
    expect(fresh.weather?.temperatureC).toBe(12.3);
    expect(fresh.cached).toBe(false);
    now = Date.parse('2026-11-19T13:01:00Z');
    const stale = await get(50, 10);
    expect(stale.weather).toBeNull();
    expect(stale.cached).toBe(false);
  });

  it('caches elevation from the initial weather lookup so unlocking needs zero extra HTTP calls', async () => {
    const now = Date.parse('2026-11-19T12:05:00Z');
    const fetcher = vi.fn(async () => metNoResponse('2026-11-19T12:00:00Z', { altitudeM: 250 }));
    const get = createIntelligenceProvider({
      fetcher: fetcher as typeof fetch,
      now: () => now,
    });

    const weatherOnly = await get(50, 10, { includeEnvironment: false });
    expect(weatherOnly.weather?.temperatureC).toBe(12.3);
    expect(weatherOnly.environment.elevationM).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Subsequent unlocked request reuses cached weather and elevation with 0 extra fetches.
    const full = await get(50, 10);
    expect(full.cached).toBe(true);
    expect(full.weather?.temperatureC).toBe(12.3);
    expect(full.environment.elevationM).toBe(250);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('logs MET Norway failures without coordinates and opens circuit breaker during outages', async () => {
    let now = Date.parse('2026-11-19T12:05:00Z');
    const log = { warn: vi.fn() };
    let fail = true;
    const fetcher = vi.fn(async () => {
      if (fail) {
        return new Response('rate limited', { status: 429 });
      }
      return metNoResponse('2026-11-19T12:00:00Z');
    });
    const get = createIntelligenceProvider({
      fetcher: fetcher as typeof fetch,
      now: () => now,
      log,
      circuitFailureThreshold: 3,
      circuitOpenMs: 20_000,
    });

    // 3 consecutive failures on distinct coordinates trip the circuit breaker.
    await get(10.1234, 20.5678, { includeEnvironment: false });
    await get(20.1234, 30.5678, { includeEnvironment: false });
    await get(30.1234, 40.5678, { includeEnvironment: false });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/weatherapi/locationforecast/2.0/complete',
        status: 429,
      }),
      'MET Norway weather request failed',
    );
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/weatherapi/locationforecast/2.0/complete',
        consecutiveFailures: 3,
      }),
      'MET Norway circuit breaker opened',
    );
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain('10.1234');

    // While circuit is open, a 4th distinct coordinate short-circuits with 0 HTTP calls.
    const blocked = await get(40, 40, { includeEnvironment: false });
    expect(blocked.weather).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);

    // After circuitOpenMs elapses, a healthy probe succeeds and closes the circuit.
    now += 21_000;
    fail = false;
    const recovered = await get(50, 50, { includeEnvironment: false });
    expect(recovered.weather?.temperatureC).toBe(12.3);
    expect(fetcher).toHaveBeenCalledTimes(4);
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

  it('withholds non-visual extra clues on medium and hard until unlocked, while keeping core weather and visible condition', async () => {
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
        precipitationIntervalMinutes: 60,
        dewPointC: 5.8,
        cloudCoverPct: 62,
        uvIndex: 1.5,
        uvIndexMax24h: 6.2,
        tempMin24hC: 4.0,
        tempMax24hC: 17.5,
        precipitation24hMm: 3.4,
        windGustKmh: 21.6,
        fogPct: 12,
        thunderProbabilityPct: 10,
      },
      environment: {
        elevationM: 420,
        reliefM: null,
        terrain: null,
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
        condition: 'Partly cloudy',
        precipitationMm: 0,
        humidityPct: 64,
        windSpeedKmh: 8,
        pressureHpa: null,
        dewPointC: null,
        cloudCoverPct: null,
        uvIndex: null,
        uvIndexMax24h: null,
        tempMin24hC: null,
        tempMax24hC: null,
        precipitation24hMm: null,
        windGustKmh: null,
        fogPct: null,
        thunderProbabilityPct: null,
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
        dewPointC: 5.8,
        cloudCoverPct: 62,
        uvIndexMax24h: 6.2,
        tempMin24hC: 4.0,
        tempMax24hC: 17.5,
        precipitation24hMm: 3.4,
        windGustKmh: 21.6,
        fogPct: 12,
        thunderProbabilityPct: 10,
      });
      expect(unlocked.environment).toMatchObject({
        elevationM: 420,
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
