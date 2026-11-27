import type { GeographicIntelligence } from './contract.js';
import { WEATHER_MAX_DISPLAY_AGE_MS } from '../../config/constants.js';

type Weather = GeographicIntelligence['weather'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A missing timestamp cannot establish the age of an observation. */
export function isFreshWeatherTimestamp(modelTime: string | null, now: number): boolean {
  const timestamp = Date.parse(modelTime ?? '');
  return Number.isFinite(timestamp) && now - timestamp <= WEATHER_MAX_DISPLAY_AGE_MS;
}

/** R03: a round needs a fresh observation with all four core metrics. */
export function isValidStreetWeather(weather: Weather, now = Date.now()): boolean {
  return (
    weather !== null &&
    isFreshWeatherTimestamp(weather.modelTime, now) &&
    isFiniteNumber(weather.temperatureC) &&
    isFiniteNumber(weather.precipitationMm) &&
    isFiniteNumber(weather.humidityPct) &&
    isFiniteNumber(weather.windSpeedKmh)
  );
}

export function withCurrentRoundWeather(data: GeographicIntelligence): GeographicIntelligence {
  return isValidStreetWeather(data.weather) ? data : { ...data, weather: null };
}

/**
 * R05: withhold optional non-visual environmental and weather clues until the
 * player has unlocked additional data for the round (or difficulty grants them
 * for free). `weather.condition` stays visible because the 3D diorama already
 * depicts rain, snow, fog, storm, and clouds.
 */
export function redactLockedExtraData(
  data: GeographicIntelligence,
  unlocked: boolean,
): GeographicIntelligence {
  if (unlocked) return data;
  return {
    ...data,
    weather: data.weather
      ? {
          ...data.weather,
          pressureHpa: null,
          dewPointC: null,
          cloudCoverPct: null,
          cloudLowPct: null,
          cloudMediumPct: null,
          cloudHighPct: null,
          fogPct: null,
          windGustKmh: null,
          uvIndex: null,
          uvIndexMax24h: null,
          tempMin24hC: null,
          tempMax24hC: null,
          precipitation24hMm: null,
          thunderProbabilityPct: null,
        }
      : null,
    environment: {
      ...data.environment,
      elevationM: null,
      reliefM: null,
      terrain: null,
    },
  };
}
