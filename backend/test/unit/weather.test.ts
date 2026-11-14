import { describe, expect, it, vi } from 'vitest';

import { getFreshSnapshot } from '../../src/modules/weather/cache.js';
import { isValidWeatherData } from '../../src/modules/weather/validate.js';
import type { WeatherClient, WeatherData } from '../../src/modules/weather/types.js';

type PrismaLike = Parameters<typeof getFreshSnapshot>[0];

const validData: WeatherData = {
  temperatureC: 21.5,
  precipitationMm: 0.4,
  humidityPct: 62,
  windSpeedKmh: 12.7,
};

interface WeatherSnapshotLike {
  id: string;
  locationId: string;
  fetchedAt: Date;
  temperatureC: number;
  precipitationMm: number;
  humidityPct: number;
  windSpeedKmh: number;
  source: string;
}

function snapshot(fetchedAt: string, id = 'snap1'): WeatherSnapshotLike {
  return {
    id,
    locationId: 'loc1',
    fetchedAt: new Date(fetchedAt),
    ...validData,
    source: 'open_meteo',
  };
}

describe('isValidWeatherData', () => {
  it('accepts all four finite fields', () => {
    expect(isValidWeatherData(validData)).toBe(true);
  });

  it('ignores extra fields', () => {
    expect(isValidWeatherData({ ...validData, extra: { foo: 1 } })).toBe(true);
  });

  const missingCases: ReadonlyArray<
    readonly [string, Record<string, unknown>]
  > = [
    ['temperatureC', { precipitationMm: 1, humidityPct: 1, windSpeedKmh: 1 }],
    ['precipitationMm', { temperatureC: 1, humidityPct: 1, windSpeedKmh: 1 }],
    ['humidityPct', { temperatureC: 1, precipitationMm: 1, windSpeedKmh: 1 }],
    ['windSpeedKmh', { temperatureC: 1, precipitationMm: 1, humidityPct: 1 }],
  ];

  for (const [field, partial] of missingCases) {
    it('rejects a missing ' + field, () => {
      expect(isValidWeatherData(partial)).toBe(false);
    });
  }

  it('rejects NaN fields', () => {
    expect(isValidWeatherData({ ...validData, humidityPct: Number.NaN })).toBe(
      false,
    );
  });

  it('rejects non-number fields', () => {
    expect(isValidWeatherData({ ...validData, temperatureC: '21.5' })).toBe(
      false,
    );
  });

  it('rejects null, undefined, and primitives', () => {
    expect(isValidWeatherData(null)).toBe(false);
    expect(isValidWeatherData(undefined)).toBe(false);
    expect(isValidWeatherData(42)).toBe(false);
    expect(isValidWeatherData('weather')).toBe(false);
  });
});

describe('getFreshSnapshot cache reuse', () => {
  it('reuses a fresh snapshot without calling the weather client', async () => {
    const fresh = snapshot('2026-11-14T22:00:00Z');
    const getCurrent = vi.fn(
      async (_lat: number, _lon: number): Promise<WeatherData> => validData,
    );
    const client: WeatherClient = { getCurrent };
    const findFirst = vi.fn().mockResolvedValue(fresh);
    const create = vi.fn();
    const findUnique = vi.fn();
    const prisma = {
      weatherSnapshot: { findFirst, create },
      location: { findUnique },
    } as unknown as PrismaLike;

    const now = new Date('2026-11-14T22:30:00Z');
    const result = await getFreshSnapshot(prisma, client, 'loc1', now);

    expect(result).toBe(fresh);
    expect(getCurrent).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('refetches and stores when the cached snapshot is stale', async () => {
    const getCurrent = vi.fn(
      async (_lat: number, _lon: number): Promise<WeatherData> => validData,
    );
    const client: WeatherClient = { getCurrent };
    const created = snapshot('2026-11-14T22:30:00Z', 'snap_new');
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue(created);
    const findUnique = vi
      .fn()
      .mockResolvedValue({ lat: 48.8566, lon: 2.3522 });
    const prisma = {
      weatherSnapshot: { findFirst, create },
      location: { findUnique },
    } as unknown as PrismaLike;

    const now = new Date('2026-11-14T22:30:00Z');
    const result = await getFreshSnapshot(prisma, client, 'loc1', now);

    // The staleness query must use the 1h TTL cutoff.
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        locationId: 'loc1',
        fetchedAt: { gte: new Date('2026-11-14T21:30:00Z') },
      },
      orderBy: { fetchedAt: 'desc' },
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'loc1' } });
    expect(getCurrent).toHaveBeenCalledWith(48.8566, 2.3522);
    expect(create).toHaveBeenCalledWith({
      data: {
        locationId: 'loc1',
        temperatureC: validData.temperatureC,
        precipitationMm: validData.precipitationMm,
        humidityPct: validData.humidityPct,
        windSpeedKmh: validData.windSpeedKmh,
        source: 'open_meteo',
      },
    });
    expect(result).toBe(created);
  });
});
