import type { WeatherData } from './types.js';

/**
 * True when `value` is a valid `WeatherData`: an object whose four mandatory
 * fields are all present and finite numbers (R03). Extra fields are ignored
 * (decision B.2 — optional indicators are allowed but never required).
 */
export function isValidWeatherData(value: unknown): value is WeatherData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isFiniteNumber(record.temperatureC) &&
    isFiniteNumber(record.precipitationMm) &&
    isFiniteNumber(record.humidityPct) &&
    isFiniteNumber(record.windSpeedKmh)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
