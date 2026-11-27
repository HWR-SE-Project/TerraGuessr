import type { GeographicIntelligence } from './contract.js';
import { isFreshWeatherTimestamp } from './validate.js';
import { WEATHER_FETCH_TIMEOUT_MS } from '../../config/constants.js';

type Weather = GeographicIntelligence['weather'];
type Environment = GeographicIntelligence['environment'];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const MIN_CACHE_TTL_MS = 15 * MINUTE;
const MAX_CACHE_TTL_MS = 60 * MINUTE;
const NEGATIVE_CACHE_TTL_MS = 30_000;
const MET_NO_ENDPOINT = '/weatherapi/locationforecast/2.0/complete';

const EMPTY_ENVIRONMENT: Environment = {
  elevationM: null,
  reliefM: null,
  terrain: null,
  biome: null,
  vegetation: null,
};

// Only our fixed vocabulary crosses the trust boundary, never provider text.
function metNoCondition(symbolCode: unknown): NonNullable<Weather>['condition'] {
  if (typeof symbolCode !== 'string' || symbolCode.length === 0) return null;
  const base = symbolCode.replace(/_(day|night|polartwilight)$/, '');
  if (base === 'clearsky') return 'Clear sky';
  if (base === 'fair') return 'Mainly clear';
  if (base === 'partlycloudy') return 'Partly cloudy';
  if (base === 'cloudy') return 'Overcast';
  if (base === 'fog') return 'Fog';
  if (base.includes('thunder')) return 'Thunderstorm';
  if (base.includes('snowshowers') || base.includes('sleetshowers')) return 'Snow showers';
  if (base.includes('rainshowers')) return 'Rain showers';
  if (base.includes('snow') || base.includes('sleet')) return 'Snow';
  if (base === 'lightrain') return 'Drizzle';
  if (base.includes('rain')) return 'Rain';
  return null;
}

function metNoIsDay(symbolCode: unknown): boolean | undefined {
  if (typeof symbolCode !== 'string') return undefined;
  if (symbolCode.endsWith('_day')) return true;
  if (symbolCode.endsWith('_night')) return false;
  return undefined;
}

function number(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

interface Entry<T> {
  value: T;
  expires: number;
}

// Per-process, bounded caches: no persistence of panorama positions or provider payloads.
class Cache<T> {
  private entries = new Map<string, Entry<T>>();
  get(key: string, now: number): T | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.expires > now) return entry.value;
    this.entries.delete(key);
    return undefined;
  }
  set(key: string, value: T, expires: number) {
    this.entries.delete(key);
    if (this.entries.size >= 512)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expires });
  }
}

export interface IntelligenceLogger {
  warn(obj: unknown, msg?: string): void;
}

export interface IntelligenceLookupOptions {
  /**
   * When false, hides environment fields in the returned view (elevation is
   * still parsed and cached from the single MET Norway response so subsequent
   * unlocked lookups require zero extra upstream requests).
   */
  includeEnvironment?: boolean;
}

export const DEFAULT_CIRCUIT_FAILURE_THRESHOLD = 5;
export const DEFAULT_CIRCUIT_OPEN_MS = 20_000;

const noopLogger: IntelligenceLogger = { warn: () => {} };

class UpstreamStatusError extends Error {
  public constructor(public readonly status: number) {
    super(`Environmental provider returned HTTP ${status}`);
    this.name = 'UpstreamStatusError';
  }
}

function safeErrorSummary(error: unknown): Record<string, unknown> {
  if (error instanceof UpstreamStatusError) {
    return { kind: 'http_status', status: error.status };
  }
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return {
      kind: error.name,
      ...(typeof code === 'string' ? { code } : {}),
    };
  }
  return { kind: 'unknown' };
}

interface CachedObservation {
  weather: Weather;
  environment: Environment;
  fetchedAt: string;
}

interface ParsedEntry {
  time: string;
  ts: number;
  instantDetails: Record<string, unknown>;
  next1h?: Record<string, unknown>;
  next6h?: Record<string, unknown>;
  next12h?: Record<string, unknown>;
}

function computeCacheExpires(response: Response, currentNow: number): number {
  const header = response.headers?.get?.('expires');
  if (header) {
    const parsed = Date.parse(header);
    if (Number.isFinite(parsed) && parsed > currentNow) {
      const ttl = Math.min(MAX_CACHE_TTL_MS, Math.max(MIN_CACHE_TTL_MS, parsed - currentNow));
      return currentNow + ttl;
    }
  }
  return currentNow + MIN_CACHE_TTL_MS;
}

function parseMetNoPayload(
  data: Record<string, unknown>,
  currentNow: number,
): { weather: Weather; environment: Environment } {
  // Elevation comes directly from GeoJSON Point coordinates: [lon, lat, altitude_m].
  const geometry = asRecord(data.geometry);
  const coords = Array.isArray(geometry?.coordinates) ? geometry.coordinates : undefined;
  const rawAltitude = coords && coords.length >= 3 ? number(coords[2], -500, 9000) : null;
  const environment: Environment = {
    ...EMPTY_ENVIRONMENT,
    elevationM: rawAltitude === null ? null : Math.round(rawAltitude),
  };

  const props = asRecord(data.properties);
  if (!props) return { weather: null, environment };
  const meta = asRecord(props.meta);
  const units = asRecord(meta?.units) ?? {};
  const rawSeries = props.timeseries;
  if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
    return { weather: null, environment };
  }

  const parsedSeries: ParsedEntry[] = [];
  for (const rawEntry of rawSeries) {
    const entry = asRecord(rawEntry);
    if (!entry || typeof entry.time !== 'string') continue;
    const ts = Date.parse(entry.time);
    if (!Number.isFinite(ts)) continue;
    const entryData = asRecord(entry.data);
    const instant = asRecord(entryData?.instant);
    const instantDetails = asRecord(instant?.details) ?? {};
    parsedSeries.push({
      time: entry.time,
      ts,
      instantDetails,
      next1h: asRecord(entryData?.next_1_hours),
      next6h: asRecord(entryData?.next_6_hours),
      next12h: asRecord(entryData?.next_12_hours),
    });
  }

  if (parsedSeries.length === 0) return { weather: null, environment };
  parsedSeries.sort((a, b) => a.ts - b.ts);

  let bestEntry: ParsedEntry | undefined;
  let bestDiff = Infinity;
  for (const entry of parsedSeries) {
    if (!isFreshWeatherTimestamp(entry.time, currentNow)) continue;
    const diff = Math.abs(currentNow - entry.ts);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestEntry = entry;
    }
  }
  if (!bestEntry) return { weather: null, environment };

  const details = bestEntry.instantDetails;
  const next1h = bestEntry.next1h;
  const next6h = bestEntry.next6h;
  const next12h = bestEntry.next12h;
  const precipPeriod = next1h ?? next6h;
  const periodIntervalMinutes = next1h ? 60 : next6h ? 360 : null;
  const precipPeriodDetails = asRecord(precipPeriod?.details) ?? {};
  const symbolPeriod = next1h ?? next6h ?? next12h;
  const symbolSummary = asRecord(symbolPeriod?.summary) ?? {};
  const symbolCode = symbolSummary.symbol_code;

  const windMs =
    units.wind_speed === 'm/s' ? number(details.wind_speed, 0, 150) : null;
  const windSpeedKmh = windMs === null ? null : round1(windMs * 3.6);

  const gustMs =
    units.wind_speed_of_gust === 'm/s'
      ? number(details.wind_speed_of_gust, 0, 200)
      : null;
  const windGustKmh = gustMs === null ? null : round1(gustMs * 3.6);

  const thunderProb =
    units.probability_of_thunder === '%'
      ? (number(asRecord(next1h?.details)?.probability_of_thunder, 0, 100) ??
        number(asRecord(next6h?.details)?.probability_of_thunder, 0, 100))
      : null;

  // 24-hour rolling forecast summaries derived from the same timeseries.
  const windowStart = bestEntry.ts;
  const windowEnd = windowStart + 24 * HOUR;

  let tempMin = Infinity;
  let tempMax = -Infinity;
  let tempFirstTs = Infinity;
  let tempLastTs = -Infinity;

  let uvMax = -Infinity;
  let uvFirstTs = Infinity;
  let uvLastTs = -Infinity;

  let precipSum = 0;
  let precipCoveredMs = 0;
  let precipCursor = windowStart;

  for (const entry of parsedSeries) {
    if (entry.ts < windowStart || entry.ts > windowEnd) continue;

    if (units.air_temperature === 'celsius') {
      const t = number(entry.instantDetails.air_temperature, -100, 70);
      if (t !== null) {
        if (t < tempMin) tempMin = t;
        if (t > tempMax) tempMax = t;
        if (entry.ts < tempFirstTs) tempFirstTs = entry.ts;
        if (entry.ts > tempLastTs) tempLastTs = entry.ts;
      }
    }

    const n6Details = asRecord(entry.next6h?.details);
    if (n6Details && entry.ts + 6 * HOUR <= windowEnd) {
      if (units.air_temperature_min === 'celsius') {
        const tMin = number(n6Details.air_temperature_min, -100, 70);
        if (tMin !== null) {
          if (tMin < tempMin) tempMin = tMin;
          if (entry.ts < tempFirstTs) tempFirstTs = entry.ts;
          if (entry.ts + 6 * HOUR > tempLastTs) tempLastTs = entry.ts + 6 * HOUR;
        }
      }
      if (units.air_temperature_max === 'celsius') {
        const tMax = number(n6Details.air_temperature_max, -100, 70);
        if (tMax !== null) {
          if (tMax > tempMax) tempMax = tMax;
          if (entry.ts < tempFirstTs) tempFirstTs = entry.ts;
          if (entry.ts + 6 * HOUR > tempLastTs) tempLastTs = entry.ts + 6 * HOUR;
        }
      }
    }

    if (units.ultraviolet_index_clear_sky === '1') {
      const uv = number(entry.instantDetails.ultraviolet_index_clear_sky, 0, 25);
      if (uv !== null) {
        if (uv > uvMax) uvMax = uv;
        if (entry.ts < uvFirstTs) uvFirstTs = entry.ts;
        if (entry.ts > uvLastTs) uvLastTs = entry.ts;
      }
    }

    if (units.precipitation_amount === 'mm' && entry.ts >= precipCursor && entry.ts < windowEnd) {
      const p1 = number(asRecord(entry.next1h?.details)?.precipitation_amount, 0, 1000);
      const p6 = number(n6Details?.precipitation_amount, 0, 1000);
      if (p1 !== null && entry.ts + HOUR <= windowEnd) {
        precipSum += p1;
        precipCoveredMs += HOUR;
        precipCursor = entry.ts + HOUR;
      } else if (p6 !== null && entry.ts + 6 * HOUR <= windowEnd) {
        precipSum += p6;
        precipCoveredMs += 6 * HOUR;
        precipCursor = entry.ts + 6 * HOUR;
      }
    }
  }

  const hasTempRange =
    Number.isFinite(tempMin) &&
    Number.isFinite(tempMax) &&
    tempLastTs - tempFirstTs >= 12 * HOUR;
  const hasUvMax = Number.isFinite(uvMax) && uvLastTs - uvFirstTs >= 12 * HOUR;
  const hasPrecip24h = precipCoveredMs >= 18 * HOUR;

  const isDay = metNoIsDay(symbolCode);

  const result: NonNullable<Weather> = {
    modelTime: bestEntry.time,
    temperatureC:
      units.air_temperature === 'celsius'
        ? number(details.air_temperature, -100, 70)
        : null,
    condition: metNoCondition(symbolCode),
    windSpeedKmh,
    windDirectionDeg:
      units.wind_from_direction === 'degrees'
        ? number(details.wind_from_direction, 0, 360)
        : null,
    humidityPct:
      units.relative_humidity === '%'
        ? number(details.relative_humidity, 0, 100)
        : null,
    pressureHpa:
      units.air_pressure_at_sea_level === 'hPa'
        ? number(details.air_pressure_at_sea_level, 100, 1200)
        : null,
    precipitationMm:
      units.precipitation_amount === 'mm'
        ? number(precipPeriodDetails.precipitation_amount, 0, 1000)
        : null,
    precipitationIntervalMinutes: periodIntervalMinutes,
    ...(isDay !== undefined ? { isDay } : {}),
    dewPointC:
      units.dew_point_temperature === 'celsius'
        ? number(details.dew_point_temperature, -100, 70)
        : null,
    cloudCoverPct:
      units.cloud_area_fraction === '%'
        ? number(details.cloud_area_fraction, 0, 100)
        : null,
    cloudLowPct:
      units.cloud_area_fraction_low === '%'
        ? number(details.cloud_area_fraction_low, 0, 100)
        : null,
    cloudMediumPct:
      units.cloud_area_fraction_medium === '%'
        ? number(details.cloud_area_fraction_medium, 0, 100)
        : null,
    cloudHighPct:
      units.cloud_area_fraction_high === '%'
        ? number(details.cloud_area_fraction_high, 0, 100)
        : null,
    fogPct:
      units.fog_area_fraction === '%'
        ? number(details.fog_area_fraction, 0, 100)
        : null,
    windGustKmh,
    uvIndex:
      units.ultraviolet_index_clear_sky === '1'
        ? number(details.ultraviolet_index_clear_sky, 0, 25)
        : null,
    uvIndexMax24h: hasUvMax ? round1(uvMax) : null,
    tempMin24hC: hasTempRange ? round1(tempMin) : null,
    tempMax24hC: hasTempRange ? round1(tempMax) : null,
    precipitation24hMm: hasPrecip24h ? round1(precipSum) : null,
    thunderProbabilityPct: thunderProb,
  };

  const hasMetric = Object.entries(result).some(
    ([key, value]) =>
      key !== 'modelTime' &&
      key !== 'precipitationIntervalMinutes' &&
      value !== null &&
      value !== undefined,
  );

  return {
    weather: hasMetric ? result : null,
    environment,
  };
}

export function createIntelligenceProvider(
  options: {
    baseUrl?: string;
    userAgent?: string;
    fetcher?: typeof fetch;
    now?: () => number;
    log?: IntelligenceLogger;
    circuitFailureThreshold?: number;
    circuitOpenMs?: number;
  } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const log = options.log ?? noopLogger;
  const circuitFailureThreshold =
    options.circuitFailureThreshold ?? DEFAULT_CIRCUIT_FAILURE_THRESHOLD;
  const circuitOpenMs = options.circuitOpenMs ?? DEFAULT_CIRCUIT_OPEN_MS;

  const cache = new Cache<CachedObservation>();
  const pending = new Map<string, Promise<CachedObservation>>();
  const baseUrl = options.baseUrl ?? 'https://api.met.no';
  const userAgent =
    options.userAgent ?? 'TerraGuessr/0.1 (+https://github.com/TerraGuessr)';

  let consecutiveFailures = 0;
  let circuitOpenUntil = 0;

  async function fetchMetNo(
    lat: number,
    lon: number,
  ): Promise<{ observation: CachedObservation; expires: number }> {
    const url = new URL(MET_NO_ENDPOINT, baseUrl);
    url.search = new URLSearchParams({
      lat: lat.toFixed(4),
      lon: lon.toFixed(4),
    }).toString();

    const response = await fetcher(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new UpstreamStatusError(response.status);
    const data: unknown = await response.json();
    const record = asRecord(data);
    if (!record) throw new Error('Invalid MET Norway weather data');

    const currentNow = now();
    const parsed = parseMetNoPayload(record, currentNow);
    const observation: CachedObservation = {
      weather: parsed.weather,
      environment: parsed.environment,
      fetchedAt: new Date(currentNow).toISOString(),
    };
    const expires =
      parsed.weather !== null
        ? computeCacheExpires(response, currentNow)
        : currentNow + NEGATIVE_CACHE_TTL_MS;
    return { observation, expires };
  }

  function fetchDedup(
    key: string,
    lat: number,
    lon: number,
  ): Promise<CachedObservation> {
    const existing = pending.get(key);
    if (existing) return existing;

    const job = (async () => {
      try {
        const { observation, expires } = await fetchMetNo(lat, lon);
        consecutiveFailures = 0;
        circuitOpenUntil = 0;
        cache.set(key, observation, expires);
        return observation;
      } catch (error: unknown) {
        consecutiveFailures += 1;
        log.warn(
          {
            endpoint: MET_NO_ENDPOINT,
            consecutiveFailures,
            ...safeErrorSummary(error),
          },
          'MET Norway weather request failed',
        );
        if (consecutiveFailures >= circuitFailureThreshold) {
          circuitOpenUntil = now() + circuitOpenMs;
          log.warn(
            {
              endpoint: MET_NO_ENDPOINT,
              consecutiveFailures,
              openMs: circuitOpenMs,
            },
            'MET Norway circuit breaker opened',
          );
        }
        const entry: CachedObservation = {
          weather: null,
          environment: { ...EMPTY_ENVIRONMENT },
          fetchedAt: new Date(now()).toISOString(),
        };
        cache.set(key, entry, now() + NEGATIVE_CACHE_TTL_MS);
        return entry;
      }
    })().finally(() => {
      pending.delete(key);
    });

    pending.set(key, job);
    return job;
  }

  return async (
    lat: number,
    lon: number,
    lookupOptions: IntelligenceLookupOptions = {},
  ): Promise<GeographicIntelligence> => {
    if (number(lat, -90, 90) === null || number(lon, -180, 180) === null) {
      throw new Error('Invalid server location');
    }
    const includeEnvironment = lookupOptions.includeEnvironment ?? true;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const time = now();
    const cachedEntry = cache.get(key, time);

    // Negative-cache entries stay usable for their short TTL; a stale
    // positive entry is treated as a miss so the observation is re-fetched.
    const usableCached =
      cachedEntry &&
      (cachedEntry.weather === null ||
        isFreshWeatherTimestamp(cachedEntry.weather.modelTime, time))
        ? cachedEntry
        : undefined;

    const circuitOpen = !usableCached && time < circuitOpenUntil;
    const obs = usableCached
      ? usableCached
      : circuitOpen
        ? {
            weather: null as Weather,
            environment: { ...EMPTY_ENVIRONMENT },
            fetchedAt: new Date(time).toISOString(),
          }
        : await fetchDedup(key, lat, lon);

    // Re-check at display time: a cached observation can cross the
    // 120-minute limit while it is still inside the cache TTL.
    const displayTime = now();
    const displayedWeather =
      obs.weather && isFreshWeatherTimestamp(obs.weather.modelTime, displayTime)
        ? obs.weather
        : null;

    return {
      fetchedAt: obs.fetchedAt,
      cached: Boolean(usableCached),
      weather: displayedWeather,
      environment: includeEnvironment ? obs.environment : { ...EMPTY_ENVIRONMENT },
      climate: null,
    };
  };
}
