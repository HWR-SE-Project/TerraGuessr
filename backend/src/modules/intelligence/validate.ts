import type { GeographicIntelligence } from './contract.js';

type Weather = GeographicIntelligence['weather'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * R03: a location is only accepted once its four mandatory base metrics
 * (temperature, precipitation, humidity, wind speed) are all present and
 * finite. Extra optional fields (pressure, wind direction, elevation, ...)
 * are never required.
 *
 * This is the single weather validator shared by singleplayer and lobbies via
 * `selectValidatedTarget`; the legacy `modules/weather/validate.ts` copy has
 * been removed.
 */
export function isValidStreetWeather(weather: Weather): boolean {
  if (!weather) return false;
  return (
    isFiniteNumber(weather.temperatureC) &&
    isFiniteNumber(weather.precipitationMm) &&
    isFiniteNumber(weather.humidityPct) &&
    isFiniteNumber(weather.windSpeedKmh)
  );
}
