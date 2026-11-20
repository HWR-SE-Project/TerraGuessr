import type { GeographicIntelligence } from '../intelligence/contract.js';
import { PanoramaError } from './providerErrors.js';
import type { PanoramaProvider, PanoramaTarget } from './provider.js';

type Weather = GeographicIntelligence['weather'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * R03: a location is only accepted once its four mandatory base metrics
 * (temperature, precipitation, humidity, wind speed) are all present and
 * finite. Extra optional fields (pressure, wind direction, elevation, ...)
 * are never required.
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

export type IntelligenceLookup = (
  lat: number,
  lon: number,
) => Promise<GeographicIntelligence>;

/** Bounds the outer weather-validation loop; the provider's own candidate
 * exhaustion (ROAD_TARGETS.length) bounds it further. Never infinite. */
const MAX_WEATHER_ATTEMPTS = 6;

/**
 * Selects a panorama target whose coordinates also have the mandatory
 * weather data available (R03), automatically excluding and retrying with a
 * different target when it does not (R13). A target rejected for missing
 * weather is added to the exclusion set so it is never re-offered within the
 * same selection, by this call or the underlying provider.
 */
export async function selectValidatedTarget(
  used: number[],
  provider: PanoramaProvider,
  intelligence: IntelligenceLookup,
  maxAttempts = MAX_WEATHER_ATTEMPTS,
): Promise<PanoramaTarget> {
  const excluded = [...used];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Pass a snapshot: `excluded` is mutated below, and callers must never
    // observe it changing out from under a call they already received.
    const target = await provider([...excluded]);
    const data = await intelligence(target.lat, target.lon).catch(() => null);
    if (data && isValidStreetWeather(data.weather)) return target;
    excluded.push(target.targetIndex);
  }
  throw new PanoramaError(
    'No location with available weather data could be found nearby. Please retry.',
    'WEATHER_UNAVAILABLE',
  );
}
