// Deterministic stand-in for MET Norway Locationforecast 2.0 (/complete):
// e2e tests must never depend on live egress or real weather. Serves the exact
// GeoJSON shape the intelligence provider (src/modules/intelligence/service.ts)
// parses, with fixed values and a 24-hour timeseries, for any lat/lon.
// Zero dependencies — plain Node http.
import { createServer } from 'node:http';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

function freshForecastBody(lat, lon) {
  const baseMs = Date.now() - 5 * 60_000;
  const timeseries = [];
  for (let hour = 0; hour <= 24; hour += 1) {
    const time = new Date(baseMs + hour * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const temp = Math.round((21.5 + Math.sin((hour / 24) * Math.PI * 2) * 4.5) * 10) / 10;
    const uv = Math.max(0, Math.round(Math.sin(((hour + 4) / 24) * Math.PI * 2) * 7.2 * 10) / 10);
    timeseries.push({
      time,
      data: {
        instant: {
          details: {
            air_pressure_at_sea_level: 1013.2,
            air_temperature: temp,
            cloud_area_fraction: 32.0,
            cloud_area_fraction_high: 18.0,
            cloud_area_fraction_low: 12.0,
            cloud_area_fraction_medium: 14.0,
            dew_point_temperature: 13.8,
            fog_area_fraction: 0.0,
            relative_humidity: 62.0,
            ultraviolet_index_clear_sky: uv,
            wind_from_direction: 245.0,
            wind_speed: 3.5,
            wind_speed_of_gust: 6.1,
          },
        },
        next_1_hours: {
          summary: { symbol_code: 'fair_day' },
          details: {
            precipitation_amount: hour === 0 ? 0.4 : 0.1,
            probability_of_precipitation: 25.0,
            probability_of_thunder: 0.0,
          },
        },
        next_6_hours: {
          summary: { symbol_code: 'fair_day' },
          details: {
            air_temperature_max: 26.0,
            air_temperature_min: 17.0,
            precipitation_amount: 1.0,
          },
        },
      },
    });
  }

  return JSON.stringify({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lon, lat, 120],
    },
    properties: {
      meta: {
        updated_at: new Date(baseMs).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        units: {
          air_pressure_at_sea_level: 'hPa',
          air_temperature: 'celsius',
          air_temperature_max: 'celsius',
          air_temperature_min: 'celsius',
          cloud_area_fraction: '%',
          cloud_area_fraction_high: '%',
          cloud_area_fraction_low: '%',
          cloud_area_fraction_medium: '%',
          dew_point_temperature: 'celsius',
          fog_area_fraction: '%',
          precipitation_amount: 'mm',
          probability_of_precipitation: '%',
          probability_of_thunder: '%',
          relative_humidity: '%',
          ultraviolet_index_clear_sky: '1',
          wind_from_direction: 'degrees',
          wind_speed: 'm/s',
          wind_speed_of_gust: 'm/s',
        },
      },
      timeseries,
    },
  });
}

let failuresRemaining = 0;
let failuresServed = 0;
let forecastsServed = 0;
let lastFailedCoordinates = null;

const server = createServer((req, res) => {
  // Test-only control endpoint. CI and local Playwright use the mock's
  // separately published port to trigger one upstream failure deterministically.
  if (req.method === 'POST' && req.url?.startsWith('/__test__/fail-next')) {
    const count = Number(new URL(req.url, 'http://localhost').searchParams.get('count') ?? '1');
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      res.writeHead(400);
      res.end();
      return;
    }
    failuresRemaining += count;
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'GET' && req.url === '/__test__/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ failuresRemaining, failuresServed, forecastsServed, lastFailedCoordinates }));
    return;
  }
  if (req.url && req.url.startsWith('/weatherapi/locationforecast/2.0/complete')) {
    forecastsServed += 1;
    const query = new URL(req.url, 'http://localhost').searchParams;
    const lat = Number(query.get('lat'));
    const lon = Number(query.get('lon'));
    if (failuresRemaining > 0) {
      failuresRemaining -= 1;
      failuresServed += 1;
      lastFailedCoordinates = { lat, lon };
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'simulated weather failure' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(freshForecastBody(lat, lon));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log('fake-met-no listening on :' + PORT);
});
