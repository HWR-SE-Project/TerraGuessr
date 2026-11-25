// Deterministic stand-in for Open-Meteo (ADR-0012): e2e must never depend on
// live egress or real weather. Serves the exact /v1/forecast shape the
// intelligence provider (src/modules/intelligence/service.ts) parses, with
// fixed values, for any latitude/longitude. Zero dependencies — plain Node http.
import { createServer } from 'node:http';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

function freshForecastBody() {
  const observedAt = new Date(Date.now() - 5 * 60_000);
  const isoMinute = observedAt.toISOString().slice(0, 16);
  const isoDay = isoMinute.slice(0, 10);
  return JSON.stringify({
    current: {
      time: isoMinute,
      interval: 900,
      temperature_2m: 21.5,
      weather_code: 1,
      relative_humidity_2m: 62,
      precipitation: 0.4,
      wind_speed_10m: 12.7,
      wind_direction_10m: 245,
      surface_pressure: 1013.2,
      is_day: 1,
    },
    current_units: {
      temperature_2m: '°C',
      relative_humidity_2m: '%',
      wind_speed_10m: 'km/h',
      wind_direction_10m: '°',
      surface_pressure: 'hPa',
      precipitation: 'mm',
    },
    daily: { time: [isoDay], sunshine_duration: [7200] },
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
  if (req.url && req.url.startsWith('/v1/forecast')) {
    forecastsServed += 1;
    if (failuresRemaining > 0) {
      failuresRemaining -= 1;
      failuresServed += 1;
      const query = new URL(req.url, 'http://localhost').searchParams;
      lastFailedCoordinates = {
        lat: Number(query.get('latitude')),
        lon: Number(query.get('longitude')),
      };
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'simulated weather failure' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(freshForecastBody());
    return;
  }
  if (req.url && req.url.startsWith('/v1/elevation')) {
    const query = new URL(req.url, 'http://localhost').searchParams;
    const latitudes = (query.get('latitude') ?? '').split(',').filter(Boolean);
    const count = Math.max(1, latitudes.length);
    const elevation = Array.from({ length: count }, (_, idx) => 120 + (idx % 3) * 15);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ elevation }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log('fake-open-meteo listening on :' + PORT);
});
