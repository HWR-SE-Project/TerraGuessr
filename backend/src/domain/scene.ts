/**
 * Pure R04-safe diorama scene derivation from biome + live weather (R20).
 *
 * No I/O, no randomness (seed is passed in), no location identifiers.
 */

export const BIOMES = [
  'desert',
  'forest',
  'mountains',
  'tundra',
  'coast',
  'grasslands',
  'urban',
] as const;
export type Biome = (typeof BIOMES)[number];

export const SCENE_WEATHERS = [
  'clear',
  'cloudy',
  'fog',
  'rain',
  'storm',
  'snow',
] as const;
export type SceneWeather = (typeof SCENE_WEATHERS)[number];

export const SCENE_LIGHTINGS = ['day', 'dusk', 'night'] as const;
export type SceneLighting = (typeof SCENE_LIGHTINGS)[number];

export const TEMPERATURE_BANDS = [
  'freezing',
  'cold',
  'mild',
  'warm',
  'hot',
] as const;
export type TemperatureBand = (typeof TEMPERATURE_BANDS)[number];

export const WIND_BANDS = ['calm', 'breezy', 'windy'] as const;
export type WindBand = (typeof WIND_BANDS)[number];

export interface RoundScene {
  biome: Biome;
  weather: SceneWeather;
  lighting: SceneLighting;
  temperatureBand: TemperatureBand;
  windBand: WindBand;
  /** Random per-round seed (never derived from target index or coordinates). */
  seed: number;
}

export interface WeatherSceneInput {
  temperatureC: number | null;
  precipitationMm: number | null;
  windSpeedKmh: number | null;
  condition: string | null;
  isDay?: boolean | null;
}

export function classifySceneWeather(weather: WeatherSceneInput): SceneWeather {
  const condition = weather.condition;
  const precip = weather.precipitationMm ?? 0;
  const temp = weather.temperatureC ?? 15;

  if (condition === 'Thunderstorm') return 'storm';
  if (
    condition === 'Snow' ||
    condition === 'Snow grains' ||
    condition === 'Snow showers' ||
    (precip >= 0.2 && temp <= 1)
  ) {
    return 'snow';
  }
  if (
    condition === 'Rain' ||
    condition === 'Freezing rain' ||
    condition === 'Rain showers' ||
    condition === 'Drizzle' ||
    condition === 'Freezing drizzle' ||
    precip >= 0.2
  ) {
    return 'rain';
  }
  if (condition === 'Fog') return 'fog';
  if (condition === 'Partly cloudy' || condition === 'Overcast') return 'cloudy';
  return 'clear';
}

export function classifyTemperatureBand(
  temperatureC: number | null,
): TemperatureBand {
  if (temperatureC == null || !Number.isFinite(temperatureC)) return 'mild';
  if (temperatureC <= 1) return 'freezing';
  if (temperatureC <= 10) return 'cold';
  if (temperatureC <= 22) return 'mild';
  if (temperatureC <= 30) return 'warm';
  return 'hot';
}

export function classifyWindBand(windSpeedKmh: number | null): WindBand {
  if (windSpeedKmh == null || !Number.isFinite(windSpeedKmh)) return 'calm';
  if (windSpeedKmh < 15) return 'calm';
  if (windSpeedKmh < 35) return 'breezy';
  return 'windy';
}

/**
 * Coarse sky lighting (`day | dusk | night`) from MET Norway `isDay` plus an
 * approximate solar hour band so sunrise/sunset reads as dusk without exposing
 * exact longitude or timezone.
 */
export function classifyLighting(
  lon: number,
  now: Date = new Date(),
  isDay?: boolean | null,
): SceneLighting {
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const solarHour = (((utcHours + lon / 15) % 24) + 24) % 24;
  if (
    (solarHour >= 5.25 && solarHour < 7.25) ||
    (solarHour >= 17.75 && solarHour < 20.0)
  ) {
    return 'dusk';
  }
  if (typeof isDay === 'boolean') {
    return isDay ? 'day' : 'night';
  }
  return solarHour >= 7.25 && solarHour < 17.75 ? 'day' : 'night';
}

export function buildRoundScene(input: {
  biome: Biome;
  weather: WeatherSceneInput;
  lon: number;
  seed: number;
  now?: Date;
}): RoundScene {
  return {
    biome: input.biome,
    weather: classifySceneWeather(input.weather),
    lighting: classifyLighting(input.lon, input.now, input.weather.isDay),
    temperatureBand: classifyTemperatureBand(input.weather.temperatureC),
    windBand: classifyWindBand(input.weather.windSpeedKmh),
    seed: input.seed,
  };
}
