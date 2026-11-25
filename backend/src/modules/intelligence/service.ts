import type { GeographicIntelligence } from './contract.js';
import { isFreshWeatherTimestamp } from './validate.js';
import { WEATHER_FETCH_TIMEOUT_MS } from '../../config/constants.js';

type Weather = GeographicIntelligence['weather'];
type Environment = GeographicIntelligence['environment'];
const MINUTE = 60_000;
const EMPTY_ENVIRONMENT: Environment = {
  elevationM: null,
  reliefM: null,
  terrain: null,
  biome: null,
  vegetation: null,
};
// Only our fixed vocabulary crosses the trust boundary, never provider text.
function condition(code: unknown): NonNullable<Weather>['condition'] {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if ([51, 53, 55].includes(code as number)) return 'Drizzle';
  if ([56, 57].includes(code as number)) return 'Freezing drizzle';
  if ([61, 63, 65].includes(code as number)) return 'Rain';
  if ([66, 67].includes(code as number)) return 'Freezing rain';
  if ([71, 73, 75].includes(code as number)) return 'Snow';
  if (code === 77) return 'Snow grains';
  if ([80, 81, 82].includes(code as number)) return 'Rain showers';
  if ([85, 86].includes(code as number)) return 'Snow showers';
  if ([95, 96, 99].includes(code as number)) return 'Thunderstorm';
  return null;
}
function number(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
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
   * When false, skips fetching `/v1/elevation` (still returns cached elevation
   * if already warm). Used during weather-only round validation and locked
   * Medium/Hard rounds where elevation clues are redacted anyway.
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

export function createIntelligenceProvider(
  options: {
    baseUrl?: string;
    apiKey?: string;
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

  const weatherCache = new Cache<{ weather: Weather; fetchedAt: string }>();
  const environmentCache = new Cache<Environment>();
  const pendingWeather = new Map<string, Promise<{ weather: Weather; fetchedAt: string }>>();
  const pendingEnvironment = new Map<string, Promise<Environment>>();
  const baseUrl = options.baseUrl ?? 'https://api.open-meteo.com';

  let consecutiveWeatherFailures = 0;
  let circuitOpenUntil = 0;

  async function json(
    path: string,
    params: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(path, baseUrl);
    url.search = new URLSearchParams({
      ...params,
      ...(options.apiKey ? { apikey: options.apiKey } : {}),
    }).toString();
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new UpstreamStatusError(response.status);
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('Invalid environmental data');
    return data as Record<string, unknown>;
  }
  async function weather(lat: number, lon: number): Promise<Weather> {
    const data = await json('/v1/forecast', {
      latitude: String(lat),
      longitude: String(lon),
      timezone: 'GMT',
      current:
        'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,precipitation,is_day',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm',
    });
    if (
      !data.current ||
      typeof data.current !== 'object' ||
      Array.isArray(data.current)
    )
      return null;
    const c = data.current as Record<string, unknown>;
    const units = (data.current_units ?? {}) as Record<string, unknown>;
    const measured = (field: string, unit: string, min: number, max: number) =>
      units[field] === unit ? number(c[field], min, max) : null;
    const modelTime =
      typeof c.time === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(c.time) &&
      Number.isFinite(Date.parse(c.time + 'Z'))
        ? c.time + 'Z'
        : null;
    // R03: a displayed observation must carry a timestamp no older than the
    // 120-minute limit. Reject missing timestamps instead of assuming current.
    if (!isFreshWeatherTimestamp(modelTime, now())) return null;
    const result: NonNullable<Weather> = {
      modelTime,
      temperatureC: measured('temperature_2m', '°C', -100, 70),
      condition: condition(c.weather_code),
      windSpeedKmh: measured('wind_speed_10m', 'km/h', 0, 500),
      windDirectionDeg: measured('wind_direction_10m', '°', 0, 360),
      humidityPct: measured('relative_humidity_2m', '%', 0, 100),
      pressureHpa: measured('surface_pressure', 'hPa', 100, 1200),
      precipitationMm: measured('precipitation', 'mm', 0, 1000),
      precipitationIntervalMinutes:
        number(c.interval, 1, 86400) === null
          ? null
          : (c.interval as number) / 60,
      ...(c.is_day === 0 || c.is_day === 1 ? { isDay: c.is_day === 1 } : {}),
    };
    // A timestamp alone is not a usable observation: require at least one
    // projected metric.
    return Object.entries(result).some(
      ([key, value]) =>
        key !== 'modelTime' &&
        key !== 'precipitationIntervalMinutes' &&
        value !== null,
    )
      ? result
      : null;
  }
  async function environment(lat: number, lon: number): Promise<Environment> {
    const points = [[lat, lon]];
    const dx = 0.009 / Math.max(0.05, Math.cos((lat * Math.PI) / 180));
    for (const north of [-1, 0, 1])
      for (const east of [-1, 0, 1]) {
        if (north === 0 && east === 0) continue;
        points.push([
          Math.max(-90, Math.min(90, lat + north * 0.009)),
          ((lon + east * dx + 540) % 360) - 180,
        ]);
      }
    const data = await json('/v1/elevation', {
      latitude: points.map((p) => p[0]).join(','),
      longitude: points.map((p) => p[1]).join(','),
    });
    const values = Array.isArray(data.elevation)
      ? data.elevation.map((v) => number(v, -500, 9000))
      : [];
    const elevationM = values[0] ?? null;
    // This is a sampled relief proxy over ~2 km, not a biome or landform claim.
    const reliefM =
      values.length === 9 &&
      values.every((v) => v !== null) &&
      Math.abs(lat) < 85
        ? Math.round(
            Math.max(...(values as number[])) -
              Math.min(...(values as number[])),
          )
        : null;
    return {
      ...EMPTY_ENVIRONMENT,
      elevationM: elevationM === null ? null : Math.round(elevationM),
      reliefM,
      terrain:
        reliefM === null
          ? null
          : reliefM < 50
            ? 'Low relief'
            : reliefM < 200
              ? 'Rolling relief'
              : 'High relief',
    };
  }
  function fetchWeatherDedup(
    key: string,
    lat: number,
    lon: number,
  ): Promise<{ weather: Weather; fetchedAt: string }> {
    const existing = pendingWeather.get(key);
    if (existing) return existing;

    const job = weather(lat, lon)
      .then((value) => {
        consecutiveWeatherFailures = 0;
        circuitOpenUntil = 0;
        const entry = {
          weather: value,
          fetchedAt: new Date(now()).toISOString(),
        };
        weatherCache.set(
          key,
          entry,
          now() + (value ? 15 * MINUTE : 30_000),
        );
        return entry;
      })
      .catch((error: unknown) => {
        consecutiveWeatherFailures += 1;
        log.warn(
          {
            endpoint: '/v1/forecast',
            consecutiveFailures: consecutiveWeatherFailures,
            ...safeErrorSummary(error),
          },
          'Open-Meteo weather request failed',
        );
        if (consecutiveWeatherFailures >= circuitFailureThreshold) {
          circuitOpenUntil = now() + circuitOpenMs;
          log.warn(
            {
              endpoint: '/v1/forecast',
              consecutiveFailures: consecutiveWeatherFailures,
              openMs: circuitOpenMs,
            },
            'Open-Meteo circuit breaker opened',
          );
        }
        const entry = {
          weather: null as Weather,
          fetchedAt: new Date(now()).toISOString(),
        };
        weatherCache.set(key, entry, now() + 30_000);
        return entry;
      })
      .finally(() => {
        pendingWeather.delete(key);
      });

    pendingWeather.set(key, job);
    return job;
  }

  function fetchEnvironmentDedup(
    key: string,
    lat: number,
    lon: number,
  ): Promise<Environment> {
    const existing = pendingEnvironment.get(key);
    if (existing) return existing;

    const job = environment(lat, lon)
      .catch((error: unknown) => {
        log.warn(
          {
            endpoint: '/v1/elevation',
            ...safeErrorSummary(error),
          },
          'Open-Meteo elevation request failed',
        );
        return { ...EMPTY_ENVIRONMENT };
      })
      .then((value) => {
        environmentCache.set(
          key,
          value,
          now() +
            (value.elevationM !== null ? 30 * 24 * 60 * MINUTE : 30_000),
        );
        return value;
      })
      .finally(() => {
        pendingEnvironment.delete(key);
      });

    pendingEnvironment.set(key, job);
    return job;
  }

  return async (
    lat: number,
    lon: number,
    lookupOptions: IntelligenceLookupOptions = {},
  ): Promise<GeographicIntelligence> => {
    if (number(lat, -90, 90) === null || number(lon, -180, 180) === null)
      throw new Error('Invalid server location');
    const includeEnvironment = lookupOptions.includeEnvironment ?? true;
    const key = `${lat},${lon}`;
    const time = now();
    const cachedWeatherEntry = weatherCache.get(key, time);
    // Negative-cache entries stay usable for their short TTL; a stale
    // positive entry is treated as a miss so the observation is re-fetched.
    const cachedWeather =
      cachedWeatherEntry &&
      (cachedWeatherEntry.weather === null ||
        isFreshWeatherTimestamp(cachedWeatherEntry.weather.modelTime, time))
        ? cachedWeatherEntry
        : undefined;
    const cachedEnvironment = environmentCache.get(key, time);

    const weatherCircuitOpen = !cachedWeather && time < circuitOpenUntil;
    const weatherPromise = cachedWeather
      ? Promise.resolve(cachedWeather)
      : weatherCircuitOpen
        ? Promise.resolve({
            weather: null as Weather,
            fetchedAt: new Date(time).toISOString(),
          })
        : fetchWeatherDedup(key, lat, lon);

    const environmentPromise = cachedEnvironment
      ? Promise.resolve(cachedEnvironment)
      : includeEnvironment
        ? fetchEnvironmentDedup(key, lat, lon)
        : Promise.resolve({ ...EMPTY_ENVIRONMENT });

    const [w, e] = await Promise.all([weatherPromise, environmentPromise]);
    // Re-check at display time: a cached observation can cross the
    // 120-minute limit while it is still inside the cache TTL.
    const displayTime = now();
    const displayedWeather =
      w.weather && isFreshWeatherTimestamp(w.weather.modelTime, displayTime)
        ? w.weather
        : null;
    return {
      ...w,
      weather: displayedWeather,
      cached: Boolean(cachedWeather),
      environment: e,
      climate: null,
    };
  };
}
