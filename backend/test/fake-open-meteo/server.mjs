// Deterministic stand-in for Open-Meteo (ADR-0012): e2e must never depend on
// live egress or real weather. Serves the exact /v1/forecast shape
// OpenMeteoClient (src/modules/weather/client.ts) parses, with fixed values,
// for any latitude/longitude. Zero dependencies — plain Node http.
import { createServer } from 'node:http';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const BODY = JSON.stringify({
  current: {
    temperature_2m: 21.5,
    relative_humidity_2m: 62,
    precipitation: 0.4,
    wind_speed_10m: 12.7,
  },
});

const server = createServer((req, res) => {
  if (req.url && req.url.startsWith('/v1/forecast')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(BODY);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log('fake-open-meteo listening on :' + PORT);
});
