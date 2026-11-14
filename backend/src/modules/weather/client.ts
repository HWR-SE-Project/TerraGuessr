import type { WeatherClient, WeatherData } from './types.js';

const DEFAULT_OPEN_METEO_BASE_URL = 'https://api.open-meteo.com';

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: unknown;
    relative_humidity_2m?: unknown;
    precipitation?: unknown;
    wind_speed_10m?: unknown;
  };
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
      '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m' +
      '&wind_speed_unit=kmh&temperature_unit=celsius&precipitation_unit=mm';

    const response = await fetch(url);

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
    };
  }
}
