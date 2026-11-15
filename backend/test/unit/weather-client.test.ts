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
        },
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
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('https://fake.example/v1/forecast');
    expect(url).toContain('latitude=10');
    expect(url).toContain('longitude=20');
    // Phase C: every request carries a bounded timeout, never hangs forever.
    expect(init.signal).toBeInstanceOf(AbortSignal);
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
