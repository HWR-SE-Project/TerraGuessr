import { describe, expect, it, vi } from 'vitest';
import {
  selectValidatedTarget,
  isValidStreetWeather,
  nextExclusions,
} from '../../src/modules/singleplayer/locationSelection.js';
import { PanoramaError } from '../../src/modules/singleplayer/providerErrors.js';
import {
  ROAD_TARGETS,
  type PanoramaTarget,
} from '../../src/modules/singleplayer/provider.js';
import type { GeographicIntelligence } from '../../src/modules/intelligence/contract.js';

function target(index: number): PanoramaTarget {
  return {
    panoId: `pano-${index}`,
    targetIndex: index,
    lat: index,
    lon: index,
  };
}
function withWeather(
  overrides: Partial<NonNullable<GeographicIntelligence['weather']>> = {},
): GeographicIntelligence {
  return {
    fetchedAt: new Date().toISOString(),
    cached: false,
    weather: {
      modelTime: null,
      temperatureC: 10,
      condition: null,
      windSpeedKmh: 5,
      windDirectionDeg: null,
      humidityPct: 50,
      pressureHpa: null,
      precipitationMm: 0,
      precipitationIntervalMinutes: null,
      ...overrides,
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
const noWeather: GeographicIntelligence = { ...withWeather(), weather: null };

describe('isValidStreetWeather (R03)', () => {
  it('rejects a null weather payload', () => {
    expect(isValidStreetWeather(null)).toBe(false);
  });
  it('accepts all four mandatory fields present and finite', () => {
    expect(isValidStreetWeather(withWeather().weather)).toBe(true);
  });
  it('rejects a missing mandatory field', () => {
    expect(isValidStreetWeather(withWeather({ temperatureC: null }).weather)).toBe(
      false,
    );
  });
  it('rejects a non-finite mandatory field', () => {
    expect(
      isValidStreetWeather(withWeather({ windSpeedKmh: Number.NaN }).weather),
    ).toBe(false);
    expect(
      isValidStreetWeather(
        withWeather({ humidityPct: Number.POSITIVE_INFINITY }).weather,
      ),
    ).toBe(false);
  });
  it('ignores optional fields being unavailable', () => {
    expect(
      isValidStreetWeather(
        withWeather({ pressureHpa: null, windDirectionDeg: null }).weather,
      ),
    ).toBe(true);
  });
});

describe('selectValidatedTarget (R03 gate + R13 automatic fallback)', () => {
  it('accepts the first candidate when its weather is valid', async () => {
    const provider = vi.fn(async (used: number[]) => target(used.length));
    const intelligence = vi.fn(async () => withWeather());
    const result = await selectValidatedTarget([], provider, intelligence);
    expect(result.targetIndex).toBe(0);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(intelligence).toHaveBeenCalledTimes(1);
  });

  it('automatically excludes a target with missing weather and retries', async () => {
    const provider = vi.fn(async (used: number[]) => target(used.length));
    const intelligence = vi
      .fn()
      .mockResolvedValueOnce(noWeather)
      .mockResolvedValueOnce(withWeather());
    const result = await selectValidatedTarget([], provider, intelligence);
    expect(result.targetIndex).toBe(1);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[1]![0]).toContain(0);
  });

  it('treats an intelligence lookup failure the same as missing weather', async () => {
    const provider = vi.fn(async (used: number[]) => target(used.length));
    const intelligence = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(withWeather());
    const result = await selectValidatedTarget([], provider, intelligence);
    expect(result.targetIndex).toBe(1);
  });

  it('throws WEATHER_UNAVAILABLE after exhausting the bounded attempt budget', async () => {
    const provider = vi.fn(async (used: number[]) => target(used.length));
    const intelligence = vi.fn(async () => noWeather);
    await expect(
      selectValidatedTarget([], provider, intelligence, 3),
    ).rejects.toMatchObject({ code: 'WEATHER_UNAVAILABLE' });
    expect(provider).toHaveBeenCalledTimes(3);
  });

  it('never calls the provider more than maxAttempts times (bounded, no infinite loop)', async () => {
    const provider = vi.fn(async (used: number[]) => target(used.length));
    const intelligence = vi.fn(async () => noWeather);
    await expect(
      selectValidatedTarget([10, 11], provider, intelligence, 2),
    ).rejects.toBeInstanceOf(PanoramaError);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[0]![0]).toEqual([10, 11]);
    expect(provider.mock.calls[1]![0]).toEqual([10, 11, 2]);
  });
});

describe('nextExclusions (R08 endless-mode pool exhaustion)', () => {
  it('excludes every used location while unused ones remain', () => {
    expect(nextExclusions([0, 1, 2])).toEqual([0, 1, 2]);
    expect(nextExclusions([])).toEqual([]);
  });

  it('still excludes the full history one short of exhausting the pool', () => {
    const almostAll = Array.from(
      { length: ROAD_TARGETS.length - 1 },
      (_, i) => i,
    );
    expect(nextExclusions(almostAll)).toEqual(almostAll);
  });

  it('once every location has been used, only excludes the most recent one', () => {
    const all = Array.from({ length: ROAD_TARGETS.length }, (_, i) => i);
    expect(nextExclusions(all)).toEqual([all.at(-1)]);
  });

  it('keeps excluding only the latest repeat after the pool stays exhausted', () => {
    const all = Array.from({ length: ROAD_TARGETS.length }, (_, i) => i);
    const repeated = [...all, 5, 17];
    expect(nextExclusions(repeated)).toEqual([17]);
  });

  it('never returns an exclusion list wide enough to starve the provider', async () => {
    const all = Array.from({ length: ROAD_TARGETS.length }, (_, i) => i);
    const provider = vi.fn(async (used: number[]) => {
      const candidates = ROAD_TARGETS.map((_, i) => i).filter(
        (i) => !used.includes(i),
      );
      if (!candidates.length) throw new PanoramaError('Pool exhausted.');
      return { panoId: `pano-${candidates[0]}`, targetIndex: candidates[0]!, lat: 0, lon: 0 };
    });
    const intelligence = vi.fn(async () => withWeather());
    await expect(
      selectValidatedTarget(nextExclusions(all), provider, intelligence),
    ).resolves.toBeDefined();
  });
});
