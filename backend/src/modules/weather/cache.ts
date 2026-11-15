import type { PrismaClient, WeatherSnapshot } from '@prisma/client';

import { WEATHER_TTL_MS } from '../../config/constants.js';
import type { WeatherClient } from './types.js';
import { isValidWeatherData } from './validate.js';

/** Fixed retry backoff delays in milliseconds (architecture.md §11). */
const RETRY_DELAYS_MS = [250, 500, 1000] as const;

/** Typed failure thrown when weather cannot be fetched after all retries (R13). */
export class WeatherUnavailableError extends Error {
  constructor(locationId: string, cause?: unknown) {
    super(
      'Weather unavailable for location ' +
        locationId +
        ' after ' +
        RETRY_DELAYS_MS.length +
        ' retries',
    );
    this.name = 'WeatherUnavailableError';
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Return a fresh `WeatherSnapshot` for `locationId` (at most `WEATHER_TTL_MS`
 * old), fetching and storing a new one when none exists or the cached one is
 * stale. On fetch failure (network error or incomplete payload) it retries with
 * backoff 250/500/1000ms, then throws {@link WeatherUnavailableError} so the
 * caller can run the R13 fallback (drop the location, select another).
 */
export async function getFreshSnapshot(
  prisma: PrismaClient,
  weatherClient: WeatherClient,
  locationId: string,
  now: Date = new Date(),
): Promise<WeatherSnapshot> {
  const cutoff = new Date(now.getTime() - WEATHER_TTL_MS);

  const cached = await prisma.weatherSnapshot.findFirst({
    where: { locationId, fetchedAt: { gte: cutoff } },
    orderBy: { fetchedAt: 'desc' },
  });
  if (cached) {
    return cached;
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    throw new WeatherUnavailableError(
      locationId,
      new Error('Location not found: ' + locationId),
    );
  }

  let lastFailure: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 0);
    }

    try {
      const data = await weatherClient.getCurrent(location.lat, location.lon);
      if (!isValidWeatherData(data)) {
        lastFailure = new Error('Open-Meteo payload is missing required fields');
        continue;
      }

      return await prisma.weatherSnapshot.create({
        data: {
          locationId,
          temperatureC: data.temperatureC,
          precipitationMm: data.precipitationMm,
          humidityPct: data.humidityPct,
          windSpeedKmh: data.windSpeedKmh,
          ...(data.airPressureHpa !== undefined ? { airPressureHpa: data.airPressureHpa } : {}),
          ...(data.windDirectionDeg !== undefined ? { windDirectionDeg: data.windDirectionDeg } : {}),
          source: 'open_meteo',
        },
      });
    } catch (error) {
      lastFailure = error;
    }
  }

  throw new WeatherUnavailableError(locationId, lastFailure);
}
