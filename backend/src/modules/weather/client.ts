import { WEATHER_FETCH_TIMEOUT_MS } from '../../config/constants.js';
import type { WeatherClient, WeatherData } from './types.js';

const DEFAULT_OPEN_METEO_BASE_URL = 'https://api.open-meteo.com';

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: unknown;
    relative_humidity_2m?: unknown;
    precipitation?: unknown;
    wind_speed_10m?: unknown;
    surface_pressure?: unknown;
    wind_direction_10m?: unknown;
    uv_index?: unknown;
    time?: unknown;
  };
  daily?: { sunshine_duration?: unknown; time?: unknown };
}

/** Open-Meteo implementation of {@link WeatherClient} (ADR-0003, architecture.md §11). */
export class OpenMeteoClient implements WeatherClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    const raw =
      baseUrl ?? process.env.OPEN_METEO_BASE_URL ?? DEFAULT_OPEN_METEO_BASE_URL;
    this.baseUrl = raw.replace(/\/+$/, '');
  }

  async getCurrent(lat: number, lon: number): Promise<WeatherData> {
    // Exact call per architecture.md §11.
    const url =
      this.baseUrl +
      '/v1/forecast' +
      '?latitude=' + lat +
      '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,surface_pressure,wind_direction_10m,uv_index' +
      '&daily=sunshine_duration&timezone=auto&wind_speed_unit=kmh&temperature_unit=celsius&precipitation_unit=mm';

    // Phase C hardening: never let a stuck upstream hang a round-start — the
    // R13 fallback (selectWithWeatherFallback) treats any rejection here the
    // same way, timeout or otherwise, and tries the next candidate location.
    const response = await fetch(url, { signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS) });

    if (!response.ok) {
      throw new Error('Open-Meteo request failed with status ' + response.status);
    }

    const body = (await response.json()) as OpenMeteoResponse;
    const current = body.current;
    if (!current) {
      throw new Error('Open-Meteo response is missing the "current" section');
    }

    // Preserve raw values with no coercion: null/undefined must survive so the
    // validation gate in validate.ts can reject incomplete payloads (R13).
    return {
      temperatureC: current.temperature_2m as number,
      humidityPct: current.relative_humidity_2m as number,
      precipitationMm: current.precipitation as number,
      windSpeedKmh: current.wind_speed_10m as number,
      ...(typeof current.surface_pressure === 'number' && Number.isFinite(current.surface_pressure) ? { airPressureHpa: current.surface_pressure } : {}),
      ...(typeof current.wind_direction_10m === 'number' && Number.isFinite(current.wind_direction_10m) ? { windDirectionDeg: current.wind_direction_10m } : {}),
      ...(typeof current.uv_index === 'number' && Number.isFinite(current.uv_index) ? { uvIndex: current.uv_index } : {}),
      ...(typeof body.daily?.sunshine_duration === 'object' && Array.isArray(body.daily.sunshine_duration) && typeof body.daily.sunshine_duration[0] === 'number' && Number.isFinite(body.daily.sunshine_duration[0]) ? { sunshineDurationSeconds: body.daily.sunshine_duration[0] } : {}),
      ...(typeof current.time === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(current.time) ? { localTime: current.time } : {}),
    };
  }
}
