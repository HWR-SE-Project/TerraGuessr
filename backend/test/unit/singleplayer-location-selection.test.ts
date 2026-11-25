import { describe, expect, it, vi } from 'vitest';
import {
  selectRoundWithWeather,
  selectValidatedTarget,
  nextExclusions,
} from '../../src/modules/singleplayer/locationSelection.js';
import { isValidStreetWeather } from '../../src/modules/intelligence/validate.js';
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
      modelTime: new Date().toISOString(),
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

describe('weather payload validation', () => {
  it('requires a valid model timestamp within the display limit', () => {
    const now = Date.parse('2026-11-20T14:00:00Z');
    expect(isValidStreetWeather(withWeather({ modelTime: '2026-11-20T12:00:00Z' }).weather, now)).toBe(true);
    expect(isValidStreetWeather(withWeather({ modelTime: '2026-11-20T11:59:59Z' }).weather, now)).toBe(false);
    expect(isValidStreetWeather(withWeather({ modelTime: null }).weather, now)).toBe(false);
  });

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

describe('target selection with weather validation and fallback', () => {
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
      selectValidatedTarget([], provider, intelligence),
    ).rejects.toMatchObject({ code: 'WEATHER_UNAVAILABLE' });
    expect(provider).toHaveBeenCalledTimes(3);
  });

  it('never calls the provider more than maxAttempts times (bounded, no infinite loop)', async () => {
    const provider = vi.fn(async (used: number[]) => target(used.length));
    const intelligence = vi.fn(async () => noWeather);
    await expect(
      selectValidatedTarget([10, 11], provider, intelligence, { maxAttempts: 2 }),
    ).rejects.toBeInstanceOf(PanoramaError);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[0]![0]).toEqual([10, 11]);
    expect(provider.mock.calls[1]![0]).toEqual([10, 11, 2]);
  });

  it('shares the 3-location budget across prior attempted indices and re-checks prefetched targets without double-counting', async () => {
    const provider = vi.fn(async (used: number[]) => {
      const next = [0, 1, 2, 3, 4, 5].find((i) => !used.includes(i))!;
      return target(next);
    });
    const intelligence = vi.fn(async () => noWeather);

    // 2 distinct locations already tried; re-checking prefetched #1 does not consume a new slot,
    // so only 1 new location (#2) may be fetched before hitting the 3-location cap.
    await expect(
      selectRoundWithWeather([], provider, intelligence, {
        prefetched: target(1),
        alreadyAttempted: [0, 1],
      }),
    ).rejects.toMatchObject({
      code: 'WEATHER_UNAVAILABLE',
      attemptedIndices: [0, 1, 2],
    });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(intelligence).toHaveBeenCalledTimes(2); // re-check #1 + new #2

    // When 3 distinct locations are already exhausted, zero additional lookups are issued.
    provider.mockClear();
    intelligence.mockClear();
    await expect(
      selectRoundWithWeather([], provider, intelligence, {
        alreadyAttempted: [0, 1, 2],
      }),
    ).rejects.toMatchObject({
      code: 'WEATHER_UNAVAILABLE',
      attemptedIndices: [0, 1, 2],
    });
    expect(provider).not.toHaveBeenCalled();
    expect(intelligence).not.toHaveBeenCalled();
  });
});

describe('location exclusion handling when the endless-mode pool is exhausted', () => {
  it('excludes every used location plus targets within 400km of the most recent one', () => {
    const exclusions = nextExclusions([0, 1, 2]);
    expect(exclusions).toContain(0);
    expect(exclusions).toContain(1);
    expect(exclusions).toContain(2);
    expect(nextExclusions([])).toEqual([]);
  });

  it('still excludes the full history one short of exhausting the pool', () => {
    const almostAll = Array.from(
      { length: ROAD_TARGETS.length - 1 },
      (_, i) => i,
    );
    expect(nextExclusions(almostAll)).toEqual(almostAll);
  });

  it('once every location has been used, excludes the most recent one (and nearby neighbors) without starving the pool', () => {
    const all = Array.from({ length: ROAD_TARGETS.length }, (_, i) => i);
    const exclusions = nextExclusions(all);
    expect(exclusions).toContain(all.at(-1));
    expect(exclusions.length).toBeLessThan(ROAD_TARGETS.length);
  });

  it('keeps excluding the latest repeat after the pool stays exhausted', () => {
    const all = Array.from({ length: ROAD_TARGETS.length }, (_, i) => i);
    const repeated = [...all, 5, 17];
    const exclusions = nextExclusions(repeated);
    expect(exclusions).toContain(17);
    expect(exclusions.length).toBeLessThan(ROAD_TARGETS.length);
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
