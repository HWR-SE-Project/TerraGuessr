import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenMeteoClient } from '../../src/modules/weather/client.js';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('OpenMeteoClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps the Open-Meteo "current" fields to WeatherData', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        current: {
          temperature_2m: 12.3,
          relative_humidity_2m: 55,
          precipitation: 0.2,
          wind_speed_10m: 8.1,
          surface_pressure: 1013.2,
          wind_direction_10m: 245,
          uv_index: 3.1,
          time: '2026-11-17T12:00',
        },
        daily: { sunshine_duration: [7200] },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenMeteoClient('https://fake.example');
    const data = await client.getCurrent(10, 20);

    expect(data).toEqual({
      temperatureC: 12.3,
      humidityPct: 55,
      precipitationMm: 0.2,
      windSpeedKmh: 8.1,
      airPressureHpa: 1013.2,
      windDirectionDeg: 245,
      uvIndex: 3.1,
      sunshineDurationSeconds: 7200,
      localTime: '2026-11-17T12:00',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('https://fake.example/v1/forecast');
    expect(url).toContain('latitude=10');
    expect(url).toContain('longitude=20');
    expect(url).toContain('surface_pressure');
    expect(url).toContain('wind_direction_10m');
    expect(url).toContain('uv_index');
    expect(url).toContain('daily=sunshine_duration');
    expect(url).toContain('timezone=auto');
    // Phase C: every request carries a bounded timeout, never hangs forever.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps optional provider measurements unavailable without failing base weather', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      current: {
        temperature_2m: 12, relative_humidity_2m: 50, precipitation: 0, wind_speed_10m: 3,
        surface_pressure: null, wind_direction_10m: 'unknown', uv_index: null, time: null,
      },
      daily: { sunshine_duration: [null] },
    })));
    await expect(new OpenMeteoClient('https://fake.example').getCurrent(1, 2)).resolves.toEqual({
      temperatureC: 12, humidityPct: 50, precipitationMm: 0, windSpeedKmh: 3,
    });
  });

  it('supports the server-only commercial key without changing existing weather modes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ current: { temperature_2m: 12, relative_humidity_2m: 50, precipitation: 0, wind_speed_10m: 3 } }));
    vi.stubGlobal('fetch', fetchMock);
    await new OpenMeteoClient('https://customer-api.open-meteo.com', 'test-only-key').getCurrent(1, 2);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('apikey')).toBe('test-only-key');
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 503)));
    const client = new OpenMeteoClient('https://fake.example');

    await expect(client.getCurrent(0, 0)).rejects.toThrow(/status 503/);
  });

  it('throws when the response has no "current" section', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    const client = new OpenMeteoClient('https://fake.example');

    await expect(client.getCurrent(0, 0)).rejects.toThrow(/missing the "current" section/);
  });

  it('propagates an abort (timeout) as a rejection, never a hang', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError')),
    );
    const client = new OpenMeteoClient('https://fake.example');

    await expect(client.getCurrent(0, 0)).rejects.toThrow(/aborted/i);
  });
});
