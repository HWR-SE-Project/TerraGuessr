import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { registerAdminRoutes } from '../../src/modules/admin/routes.js';
import {
  regeneratePool,
  warmWeatherCache,
} from '../../src/modules/admin/service.js';
import type { LandGeoJson } from '../../src/modules/locations/pool.js';
import type { WeatherClient, WeatherData } from '../../src/modules/weather/types.js';

const ADMIN_API_TOKEN = 'test-admin-token';

const validData: WeatherData = {
  temperatureC: 21.5,
  precipitationMm: 0.4,
  humidityPct: 62,
  windSpeedKmh: 12.7,
};

type DbLike = Parameters<typeof warmWeatherCache>[0];

interface PoolRow {
  id: string;
  lat: number;
  lon: number;
  region: string;
}

const pool: PoolRow[] = [
  { id: 'loc1', lat: 48.8566, lon: 2.3522, region: 'EUROPE' },
  { id: 'loc2', lat: 40.7128, lon: -74.006, region: 'NORTH_AMERICA' },
];

function makeWeatherClient(): WeatherClient {
  return {
    getCurrent: vi.fn(async (_lat: number, _lon: number) => validData),
  };
}

/** A prisma stub with every method the admin service touches. */
function makeDb(): DbLike {
  return {
    location: {
      findMany: vi.fn().mockResolvedValue(pool),
      findUnique: vi
        .fn()
        .mockImplementation((args: { where: { id: string } }) => {
          const row = pool.find((item) => item.id === args.where.id);
          return row ? { lat: row.lat, lon: row.lon } : null;
        }),
      upsert: vi.fn().mockResolvedValue({ id: 'upserted' }),
    },
    weatherSnapshot: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'snap1' }),
    },
  } as unknown as DbLike;
}

function buildAdminApp(
  db: DbLike,
  weatherClient: WeatherClient,
  adminApiToken = ADMIN_API_TOKEN,
): FastifyInstance {
  const app = Fastify();
  registerErrorHandler(app);
  registerAdminRoutes(app, { adminApiToken, db, weatherClient });
  return app;
}

/**
 * The frozen /api/admin/* surface. Every route must be bearer-guarded (B.14);
 * adding a route to this list automatically extends the guard coverage.
 */
const ADMIN_ROUTES = [
  { method: 'POST', url: '/api/admin/locations/refresh', key: 'jobId' },
  { method: 'POST', url: '/api/admin/weather/prefetch', key: 'warmed' },
] as const;

describe('admin routes (B.14)', () => {
  for (const route of ADMIN_ROUTES) {
    describe(route.method + ' ' + route.url, () => {
      it('401 UNAUTHORIZED without a bearer token', async () => {
        const app = buildAdminApp(makeDb(), makeWeatherClient());
        try {
          const res = await app.inject({ method: route.method, url: route.url });

          expect(res.statusCode).toBe(401);
          expect(res.json()).toEqual({
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          });
        } finally {
          await app.close();
        }
      });

      it('401 UNAUTHORIZED with a wrong bearer token', async () => {
        const app = buildAdminApp(makeDb(), makeWeatherClient());
        try {
          const res = await app.inject({
            method: route.method,
            url: route.url,
            headers: { authorization: 'Bearer wrong-token' },
          });

          expect(res.statusCode).toBe(401);
          expect(res.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
        } finally {
          await app.close();
        }
      });

      it('202 with the correct bearer token', async () => {
        const app = buildAdminApp(makeDb(), makeWeatherClient());
        try {
          const res = await app.inject({
            method: route.method,
            url: route.url,
            headers: { authorization: 'Bearer ' + ADMIN_API_TOKEN },
          });

          expect(res.statusCode).toBe(202);
          expect(res.json()).toHaveProperty(route.key);
        } finally {
          await app.close();
        }
      });
    });
  }

  it('locks admin routes when no admin token is configured', async () => {
    const app = buildAdminApp(makeDb(), makeWeatherClient(), '');
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/weather/prefetch',
        headers: { authorization: 'Bearer ' },
      });

      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});

describe('warmWeatherCache', () => {
  it('warms every pool location and counts them', async () => {
    const findMany = vi.fn().mockResolvedValue(pool);
    const findUnique = vi
      .fn()
      .mockImplementation((args: { where: { id: string } }) => {
        const row = pool.find((item) => item.id === args.where.id);
        return row ? { lat: row.lat, lon: row.lon } : null;
      });
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: 'snap1' });
    const getCurrent = vi.fn(
      async (_lat: number, _lon: number): Promise<WeatherData> => validData,
    );

    const db = {
      location: { findMany, findUnique },
      weatherSnapshot: { findFirst, create },
    } as unknown as DbLike;
    const weatherClient: WeatherClient = { getCurrent };

    const result = await warmWeatherCache(db, weatherClient);

    expect(result).toEqual({ warmed: 2 });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(getCurrent).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('skips locations whose weather cannot be fetched', async () => {
    const findMany = vi.fn().mockResolvedValue(pool);
    const findUnique = vi.fn().mockResolvedValue(null);
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn();
    const getCurrent = vi.fn(async () => {
      throw new Error('network down');
    });

    const db = {
      location: { findMany, findUnique },
      weatherSnapshot: { findFirst, create },
    } as unknown as DbLike;
    const weatherClient: WeatherClient = { getCurrent };

    const result = await warmWeatherCache(db, weatherClient);

    expect(result).toEqual({ warmed: 0 });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('regeneratePool', () => {
  const europeSquare: LandGeoJson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [5, 48],
              [15, 48],
              [15, 55],
              [5, 55],
              [5, 48],
            ],
          ],
        },
      },
    ],
  };

  it('re-runs the seed logic and upserts sampled land points', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const db = { location: { upsert } } as unknown as DbLike;
    const rng = (): number => 0.5;

    const count = await regeneratePool(db, {
      landGeoJson: europeSquare,
      rng,
      targetPoints: 6,
    });

    expect(count).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { id: 'grid_europe_515000_100000' },
      create: {
        id: 'grid_europe_515000_100000',
        lat: 51.5,
        lon: 10,
        region: 'EUROPE',
        isLand: true,
        source: 'grid',
      },
      update: {
        lat: 51.5,
        lon: 10,
        region: 'EUROPE',
        isLand: true,
        source: 'grid',
      },
    });
  });
});
