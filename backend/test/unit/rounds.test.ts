import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

import type { Region } from '@prisma/client';

import {
  EASY_CANDIDATES,
  MEDIUM_CANDIDATES,
  ROUNDS_PER_GAME,
} from '../../src/config/constants.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import {
  GameNotFoundError,
  generatePlayerToken,
  hashPlayerToken,
} from '../../src/plugins/auth.js';
import {
  RoundConflictError,
  ServiceUnavailableError,
  startRound,
} from '../../src/modules/rounds/service.js';
import { registerRoundsRoutes } from '../../src/modules/rounds/routes.js';
import type { WeatherClient, WeatherData } from '../../src/modules/weather/types.js';

/** Prisma client shape accepted by the rounds service (injected in tests). */
type PrismaLike = Parameters<typeof startRound>[2];

interface TestLocation {
  id: string;
  lat: number;
  lon: number;
  region: Region;
}

interface RoundLike {
  id: string;
  locationId: string;
  status: 'active' | 'completed';
  roundNumber: number;
  location: { lat: number; lon: number };
}

interface GameLike {
  id: string;
  mode: 'solo' | 'challenge';
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'active' | 'completed';
  playerTokenHash: string;
  rounds: RoundLike[];
}

/** Enough locations for a full list-mode candidate set in the AFRICA region. */
const pool: TestLocation[] = [
  { id: 'afr-1', lat: 10, lon: 20, region: 'AFRICA' },
  { id: 'afr-2', lat: 11, lon: 20, region: 'AFRICA' },
  { id: 'afr-3', lat: 12, lon: 20, region: 'AFRICA' },
  { id: 'afr-4', lat: 13, lon: 20, region: 'AFRICA' },
  { id: 'afr-5', lat: 14, lon: 20, region: 'AFRICA' },
  { id: 'afr-6', lat: 15, lon: 20, region: 'AFRICA' },
  { id: 'eu-1', lat: 48, lon: 2, region: 'EUROPE' },
  { id: 'eu-2', lat: 49, lon: 3, region: 'EUROPE' },
  { id: 'as-1', lat: 35, lon: 139, region: 'ASIA' },
  { id: 'as-2', lat: 36, lon: 140, region: 'ASIA' },
  { id: 'na-1', lat: 40, lon: -100, region: 'NORTH_AMERICA' },
  { id: 'sa-1', lat: -15, lon: -60, region: 'SOUTH_AMERICA' },
  { id: 'oc-1', lat: -25, lon: 135, region: 'OCEANIA' },
];

const validWeather: WeatherData = {
  temperatureC: 21.5,
  precipitationMm: 0.4,
  humidityPct: 62,
  windSpeedKmh: 12.7,
};

function gameWith(overrides: Partial<GameLike> = {}): GameLike {
  return {
    id: 'game-1',
    mode: 'solo',
    difficulty: 'medium',
    status: 'active',
    playerTokenHash: 'some-hash',
    rounds: [],
    ...overrides,
  };
}

function roundWith(
  id: string,
  locationId: string,
  status: 'active' | 'completed',
  roundNumber: number,
): RoundLike {
  return { id, locationId, status, roundNumber, location: { lat: 10, lon: 20 } };
}

function buildDb(game: GameLike, weatherClient?: WeatherClient) {
  const getCurrent =
    weatherClient?.getCurrent ??
    vi.fn(async (): Promise<WeatherData> => validWeather);
  const client: WeatherClient = { getCurrent };

  const locationFindMany = vi.fn(
    async (args: {
      where?: { id?: { in?: string[] } };
      select?: { id?: boolean; name?: boolean; lat?: boolean; lon?: boolean; region?: boolean };
    }) => {
      // Name lookup (resolveCandidateNames) requests only { id, name }.
      if (args.select?.name && !args.select.lat) {
        const ids = args.where?.id?.in ?? [];
        return pool
          .filter((item) => ids.includes(item.id))
          .map((item) => ({ id: item.id, name: null }));
      }
      // listPool requests { id, lat, lon, region }.
      return pool.map((item) => ({
        id: item.id,
        lat: item.lat,
        lon: item.lon,
        region: item.region,
      }));
    },
  );

  const locationFindUnique = vi.fn(
    async (args: { where: { id: string } }) => {
      const found = pool.find((item) => item.id === args.where.id);
      return found ? { id: found.id, lat: found.lat, lon: found.lon } : null;
    },
  );

  const weatherSnapshotFindFirst = vi.fn(async () => null);

  const weatherSnapshotCreate = vi.fn(
    async (args: {
      data: {
        locationId: string;
        temperatureC: number;
        precipitationMm: number;
        humidityPct: number;
        windSpeedKmh: number;
        source: string;
      };
    }) => ({
      id: 'snap-' + args.data.locationId,
      locationId: args.data.locationId,
      fetchedAt: new Date('2026-11-14T22:00:00Z'),
      temperatureC: args.data.temperatureC,
      precipitationMm: args.data.precipitationMm,
      humidityPct: args.data.humidityPct,
      windSpeedKmh: args.data.windSpeedKmh,
      source: args.data.source,
    }),
  );

  const gameFindUnique = vi.fn(async () => game);

  const roundFindMany = vi.fn(async () =>
    game.rounds.map((round) => ({ locationId: round.locationId })),
  );

  const roundCreate = vi.fn(
    async (args: {
      data: {
        gameId: string;
        locationId: string;
        weatherSnapshotId: string;
        roundNumber: number;
        difficulty: string;
        selectionMode: string;
        status: string;
      };
    }) => ({
      id: 'round-' + args.data.roundNumber,
      ...args.data,
    }),
  );

  const db = {
    game: { findUnique: gameFindUnique },
    location: { findMany: locationFindMany, findUnique: locationFindUnique },
    round: { findMany: roundFindMany, create: roundCreate },
    weatherSnapshot: {
      findFirst: weatherSnapshotFindFirst,
      create: weatherSnapshotCreate,
    },
  } as unknown as PrismaLike;

  return { db, client, roundCreate };
}

/** Deep-scan a value for R04-forbidden keys at any nesting depth. */
function findLeakedActualKeys(value: unknown): string[] {
  const leaks: string[] = [];
  const stack: Array<[string, unknown]> = [['$', value]];

  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) continue;
    const [path, current] = entry;

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i += 1) {
        stack.push([path + '[' + i + ']', current[i]]);
      }
    } else if (current !== null && typeof current === 'object') {
      for (const [key, child] of Object.entries(current)) {
        if (key === 'actualLat' || key === 'actualLon' || key === 'actual') {
          leaks.push(path + '.' + key);
        }
        stack.push([path + '.' + key, child]);
      }
    }
  }

  return leaks;
}

describe('rounds service', () => {
  describe('startRound', () => {
    it('returns a round view with weather and list candidates, leaking no actual coords (R04)', async () => {
      const { db, client } = buildDb(gameWith({ difficulty: 'medium' }));

      const view = await startRound('game-1', undefined, db, client, () => 0);

      expect(view.roundId).toBe('round-1');
      expect(view.roundNumber).toBe(1);
      expect(view.difficulty).toBe('medium');
      expect(view.selectionMode).toBe('list');
      expect(view.weather).toEqual(validWeather);
      expect(view.candidates).toHaveLength(MEDIUM_CANDIDATES);
      expect(findLeakedActualKeys(view)).toEqual([]);
    });

    it('forces list mode with candidates for easy difficulty', async () => {
      const { db, client } = buildDb(gameWith({ difficulty: 'easy' }));

      const view = await startRound('game-1', undefined, db, client, () => 0);

      expect(view.selectionMode).toBe('list');
      expect(view.candidates).toHaveLength(EASY_CANDIDATES);
      expect(findLeakedActualKeys(view)).toEqual([]);
    });

    it('omits candidates in map mode (hard)', async () => {
      const { db, client } = buildDb(gameWith({ difficulty: 'hard' }));

      const view = await startRound('game-1', undefined, db, client, () => 0);

      expect(view.selectionMode).toBe('map');
      expect(view.candidates).toBeUndefined();
      expect(findLeakedActualKeys(view)).toEqual([]);
    });

    it('honors an explicit map selection for medium difficulty', async () => {
      const { db, client } = buildDb(gameWith({ difficulty: 'medium' }));

      const view = await startRound('game-1', 'map', db, client, () => 0);

      expect(view.selectionMode).toBe('map');
      expect(view.candidates).toBeUndefined();
    });

    it('increments the round number', async () => {
      const prior = roundWith('r-1', 'afr-2', 'completed', 1);
      const { db, client, roundCreate } = buildDb(
        gameWith({ rounds: [prior] }),
      );

      const view = await startRound('game-1', undefined, db, client, () => 0);

      expect(view.roundNumber).toBe(2);
      expect(roundCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roundNumber: 2, status: 'active' }),
        }),
      );
    });

    it('returns 409 when an active round already exists', async () => {
      const active = roundWith('r-1', 'afr-1', 'active', 1);
      const { db, client } = buildDb(gameWith({ rounds: [active] }));

      await expect(
        startRound('game-1', undefined, db, client, () => 0),
      ).rejects.toBeInstanceOf(RoundConflictError);
    });

    it('returns 409 when the game is completed', async () => {
      const { db, client } = buildDb(gameWith({ status: 'completed' }));

      await expect(
        startRound('game-1', undefined, db, client, () => 0),
      ).rejects.toBeInstanceOf(RoundConflictError);
    });

    it('returns 409 when a solo game already has ROUNDS_PER_GAME rounds', async () => {
      const rounds = Array.from({ length: ROUNDS_PER_GAME }, (_, index) =>
        roundWith('r-' + index, 'afr-' + (index + 1), 'completed', index + 1),
      );
      const { db, client } = buildDb(gameWith({ mode: 'solo', rounds }));

      await expect(
        startRound('game-1', undefined, db, client, () => 0),
      ).rejects.toBeInstanceOf(RoundConflictError);
    });

    it('throws 503 SERVICE_UNAVAILABLE when weather is exhausted (R13)', async () => {
      vi.useFakeTimers();
      try {
        const failingClient: WeatherClient = {
          getCurrent: vi.fn(async (): Promise<WeatherData> => {
            throw new Error('network down');
          }),
        };
        const { db, client } = buildDb(
          gameWith({ difficulty: 'medium' }),
          failingClient,
        );

        const promise = startRound('game-1', undefined, db, client, () => 0);
        const assertion = expect(promise).rejects.toBeInstanceOf(ServiceUnavailableError);
        await vi.advanceTimersByTimeAsync(30_000);
        await assertion;
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns 404 when the game does not exist', async () => {
      const gameFindUnique = vi.fn(async () => null);
      const { db, client } = buildDb(gameWith());
      const noGameDb = {
        ...db,
        game: { findUnique: gameFindUnique },
      } as unknown as PrismaLike;

      await expect(
        startRound('missing', undefined, noGameDb, client, () => 0),
      ).rejects.toBeInstanceOf(GameNotFoundError);
    });
  });
});

describe('rounds routes', () => {
  it('POST /api/games/:id/rounds returns 201 with no actual coords on the wire (R04)', async () => {
    const token = generatePlayerToken();
    const game = gameWith({ playerTokenHash: hashPlayerToken(token) });
    const { db, client } = buildDb(game);

    const app = Fastify();
    registerErrorHandler(app);
    registerRoundsRoutes(app, db, client);

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/games/game-1/rounds',
        headers: { 'x-player-token': token },
        payload: {},
      });

      expect(res.statusCode).toBe(201);
      const body = res.json() as Record<string, unknown>;
      expect(findLeakedActualKeys(body)).toEqual([]);
      expect(body.roundId).toBe('round-1');
    } finally {
      await app.close();
    }
  });

  it('POST /api/games/:id/rounds returns 404 without a token', async () => {
    const game = gameWith();
    const { db, client } = buildDb(game);

    const app = Fastify();
    registerErrorHandler(app);
    registerRoundsRoutes(app, db, client);

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/games/game-1/rounds',
        payload: {},
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Game not found' },
      });
    } finally {
      await app.close();
    }
  });
});
