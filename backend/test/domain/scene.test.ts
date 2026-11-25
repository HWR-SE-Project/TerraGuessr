import { describe, expect, it } from 'vitest';
import {
  BIOMES,
  buildRoundScene,
  classifyLighting,
  classifySceneWeather,
  classifyTemperatureBand,
  classifyWindBand,
} from '../../src/domain/scene.js';
import { LOCATION_CATALOG } from '../../src/modules/singleplayer/locations.js';

describe('diorama scene classification (R04/R20)', () => {
  it('classifies weather conditions and precipitation fallbacks cleanly', () => {
    expect(
      classifySceneWeather({
        temperatureC: 24,
        precipitationMm: 0,
        windSpeedKmh: 8,
        condition: 'Clear sky',
      }),
    ).toBe('clear');
    expect(
      classifySceneWeather({
        temperatureC: 18,
        precipitationMm: 0,
        windSpeedKmh: 12,
        condition: 'Overcast',
      }),
    ).toBe('cloudy');
    expect(
      classifySceneWeather({
        temperatureC: 10,
        precipitationMm: 0,
        windSpeedKmh: 5,
        condition: 'Fog',
      }),
    ).toBe('fog');
    expect(
      classifySceneWeather({
        temperatureC: 12,
        precipitationMm: 2.5,
        windSpeedKmh: 15,
        condition: null,
      }),
    ).toBe('rain');
    expect(
      classifySceneWeather({
        temperatureC: -2,
        precipitationMm: 1.2,
        windSpeedKmh: 18,
        condition: null,
      }),
    ).toBe('snow');
    expect(
      classifySceneWeather({
        temperatureC: 22,
        precipitationMm: 8,
        windSpeedKmh: 40,
        condition: 'Thunderstorm',
      }),
    ).toBe('storm');
  });

  it('classifies temperature and wind bands across boundaries', () => {
    expect(classifyTemperatureBand(-5)).toBe('freezing');
    expect(classifyTemperatureBand(1)).toBe('freezing');
    expect(classifyTemperatureBand(8)).toBe('cold');
    expect(classifyTemperatureBand(18)).toBe('mild');
    expect(classifyTemperatureBand(27)).toBe('warm');
    expect(classifyTemperatureBand(36)).toBe('hot');

    expect(classifyWindBand(5)).toBe('calm');
    expect(classifyWindBand(20)).toBe('breezy');
    expect(classifyWindBand(45)).toBe('windy');
  });

  it('derives coarse day / dusk / night lighting', () => {
    expect(classifyLighting(0, new Date('2026-06-15T12:00:00Z'), true)).toBe('day');
    expect(classifyLighting(0, new Date('2026-06-15T18:30:00Z'), true)).toBe('dusk');
    expect(classifyLighting(0, new Date('2026-06-15T01:00:00Z'), false)).toBe('night');
  });

  it('builds an R04-safe RoundScene without location identifiers', () => {
    const scene = buildRoundScene({
      biome: 'tundra',
      weather: {
        temperatureC: -8,
        precipitationMm: 1.5,
        windSpeedKmh: 40,
        condition: 'Snow',
        isDay: false,
      },
      lon: 15,
      seed: 123456,
      now: new Date('2026-01-15T22:00:00Z'),
    });
    expect(scene).toEqual({
      biome: 'tundra',
      weather: 'snow',
      lighting: 'night',
      temperatureBand: 'freezing',
      windBand: 'windy',
      seed: 123456,
    });
  });

  it('maintains a globally balanced catalog across all 7 biomes', () => {
    expect(LOCATION_CATALOG.length).toBeGreaterThanOrEqual(140);
    for (const biome of BIOMES) {
      const count = LOCATION_CATALOG.filter((loc) => loc.biome === biome).length;
      expect(count).toBeGreaterThanOrEqual(20);
    }
    for (const loc of LOCATION_CATALOG) {
      expect(loc.lat).toBeGreaterThanOrEqual(-90);
      expect(loc.lat).toBeLessThanOrEqual(90);
      expect(loc.lon).toBeGreaterThanOrEqual(-180);
      expect(loc.lon).toBeLessThanOrEqual(180);
    }
  });
});
