import { describe, expect, it, vi } from 'vitest';

import type { Region } from '@prisma/client';

import { startRound } from '../../src/modules/rounds/service.js';
import type { WeatherClient, WeatherData } from '../../src/modules/weather/types.js';

/** Prisma client shape accepted by the rounds service (injected in tests). */
type PrismaLike = Parameters<typeof startRound>[2];

interface TestLocation {
  id: string;
  lat: number;
  lon: number;
  region: Region;
}

interface RoundRow {
  id: string;
  locationId: string;
  weatherSnapshotId: string;
  roundNumber: number;
  difficulty: string;
  selectionMode: string;
  status: 'active' | 'completed';
  location: { lat: number; lon: number };
}

interface GameRow {
  id: string;
  mode: 'solo' | 'challenge';
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'active' | 'completed';
  playerTokenHash: string;
  nextLocationId: string | null;
  nextWeatherSnapshotId: string | null;
  rounds: RoundRow[];
}

interface SnapshotRow {
  id: string;
  locationId: string;
  fetchedAt: Date;
  temperatureC: number;
  precipitationMm: number;
  humidityPct: number;
  windSpeedKmh: number;
  source: string;
}

const pool: TestLocation[] = [
  { id: 'loc-1', lat: 10, lon: 20, region: 'AFRICA' },
  { id: 'loc-2', lat: 11, lon: 21, region: 'AFRICA' },
  { id: 'loc-3', lat: 12, lon: 22, region: 'AFRICA' },
  { id: 'loc-4', lat: 13, lon: 23, region: 'AFRICA' },
  { id: 'loc-5', lat: 14, lon: 24, region: 'AFRICA' },
  { id: 'loc-6', lat: 15, lon: 25, region: 'AFRICA' },
  { id: 'loc-7', lat: 16, lon: 26, region: 'AFRICA' },
  { id: 'loc-8', lat: 17, lon: 27, region: 'AFRICA' },
  { id: 'loc-9', lat: 48, lon: 2, region: 'EUROPE' },
  { id: 'loc-10', lat: 49, lon: 3, region: 'EUROPE' },
  { id: 'loc-11', lat: 35, lon: 139, region: 'ASIA' },
  { id: 'loc-12', lat: -25, lon: 135, region: 'OCEANIA' },
];

const validWeather: WeatherData = {
  temperatureC: 21.5,
  precipitationMm: 0.4,
  humidityPct: 62,
  windSpeedKmh: 12.7,
};

interface State {
  game: GameRow;
  snapshots: Map<string, SnapshotRow>;
}

function makeGame(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: 'game-1',
    mode: 'solo',
    difficulty: 'medium',
    status: 'active',
    playerTokenHash: 'hash',
    nextLocationId: null,
    nextWeatherSnapshotId: null,
    rounds: [],
    ...overrides,
  };
}

/**
 * Build a mutable in-memory Prisma stub plus a tracking weather client. Each
 * created round records how many weather fetches had happened at creation time,
 * so the consume fast path can be asserted to add no new fetch.
 */
function buildDb(state: State) {
  const getCurrent = vi.fn(async (): Promise<WeatherData> => validWeather);
  const client: WeatherClient = { getCurrent };

  const createdRounds: Array<{
    roundNumber: number;
    locationId: string;
    weatherSnapshotId: string;
    getCurrentCalls: number;
  }> = [];

  const gameFindUnique = vi.fn(async () => state.game);

  const gameUpdate = vi.fn(async (args: {
    where: { id: string };
    data: { nextLocationId?: string | null; nextWeatherSnapshotId?: string | null } &
      Record<string, unknown>;
  }) => {
    if (args.data.nextLocationId !== undefined) {
      state.game.nextLocationId = args.data.nextLocationId;
    }
    if (args.data.nextWeatherSnapshotId !== undefined) {
      state.game.nextWeatherSnapshotId = args.data.nextWeatherSnapshotId;
    }
    return state.game;
  });

  const locationFindMany = vi.fn(
    async (args: {
      where?: { id?: { in?: string[] } } & Record<string, unknown>;
      select?: {
        id?: boolean;
        name?: boolean;
        lat?: boolean;
        lon?: boolean;
        region?: boolean;
      };
    }) => {
      if (args.select?.name && !args.select.lat) {
        const ids = args.where?.id?.in ?? [];
        return pool
          .filter((item) => ids.includes(item.id))
          .map((item) => ({ id: item.id, name: null }));
      }
      return pool.map((item) => ({
        id: item.id,
        lat: item.lat,
        lon: item.lon,
        region: item.region,
      }));
    },
  );

  const locationFindUnique = vi.fn(async (args: { where: { id: string } }) => {
    const found = pool.find((item) => item.id === args.where.id);
    return found ? { id: found.id, lat: found.lat, lon: found.lon } : null;
  });

  const roundFindMany = vi.fn(async () =>
    state.game.rounds.map((round) => ({ locationId: round.locationId })),
  );

  const weatherSnapshotFindFirst = vi.fn(async () => null);

  const weatherSnapshotFindUnique = vi.fn(async (args: { where: { id: string } }) =>
    state.snapshots.get(args.where.id) ?? null,
  );

  let snapshotCounter = 0;

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
    }) => {
      snapshotCounter += 1;
      const snapshot: SnapshotRow = {
        id: 'snap-' + snapshotCounter,
        locationId: args.data.locationId,
        fetchedAt: new Date(),
        temperatureC: args.data.temperatureC,
        precipitationMm: args.data.precipitationMm,
        humidityPct: args.data.humidityPct,
        windSpeedKmh: args.data.windSpeedKmh,
        source: args.data.source,
      };
      state.snapshots.set(snapshot.id, snapshot);
      return snapshot;
    },
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
    }) => {
      const location = pool.find((item) => item.id === args.data.locationId);
      const round: RoundRow = {
        id: 'round-' + args.data.roundNumber,
        locationId: args.data.locationId,
        weatherSnapshotId: args.data.weatherSnapshotId,
        roundNumber: args.data.roundNumber,
        difficulty: args.data.difficulty,
        selectionMode: args.data.selectionMode,
        status: args.data.status as 'active' | 'completed',
        location: { lat: location!.lat, lon: location!.lon },
      };
      state.game.rounds.push(round);
      createdRounds.push({
        roundNumber: args.data.roundNumber,
        locationId: args.data.locationId,
        weatherSnapshotId: args.data.weatherSnapshotId,
        getCurrentCalls: getCurrent.mock.calls.length,
      });
      return round;
    },
  );

  const db = {
    game: { findUnique: gameFindUnique, update: gameUpdate },
    location: { findMany: locationFindMany, findUnique: locationFindUnique },
    round: { findMany: roundFindMany, create: roundCreate },
    weatherSnapshot: {
      findFirst: weatherSnapshotFindFirst,
      findUnique: weatherSnapshotFindUnique,
      create: weatherSnapshotCreate,
    },
  } as unknown as PrismaLike;

  return {
    db,
    client,
    getCurrent,
    gameUpdate,
    roundCreate,
    createdRounds,
  };
}

describe('round prefetch (R12)', () => {
  it('startRound stores the next round selection on Game.next* fields', async () => {
    const state: State = { game: makeGame(), snapshots: new Map() };
    const { db, client, gameUpdate, roundCreate } = buildDb(state);

    await startRound('game-1', undefined, db, client, () => 0);

    await vi.waitFor(() => {
      expect(gameUpdate).toHaveBeenCalled();
    });

    const update = gameUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'game-1' });
    expect(update.data.nextLocationId).toBeTruthy();
    expect(update.data.nextWeatherSnapshotId).toMatch(/^snap-/);

    // The prefetched location is distinct from the round just started (R02).
    const round1LocationId = roundCreate.mock.calls[0][0].data.locationId;
    expect(update.data.nextLocationId).not.toBe(round1LocationId);
  });

  it('reuses the pending prefetch on the next startRound without a new weather fetch', async () => {
    const state: State = { game: makeGame(), snapshots: new Map() };
    const { db, client, getCurrent, gameUpdate, createdRounds } = buildDb(state);

    await startRound('game-1', undefined, db, client, () => 0);
    await vi.waitFor(() => {
      expect(gameUpdate).toHaveBeenCalled();
    });

    const prefetchedLocationId = gameUpdate.mock.calls[0][0].data.nextLocationId;
    const prefetchedSnapshotId =
      gameUpdate.mock.calls[0][0].data.nextWeatherSnapshotId;
    const fetchesAfterPrefetch = getCurrent.mock.calls.length;
    expect(fetchesAfterPrefetch).toBe(2);

    // Complete round 1 so a second round is allowed by the state machine.
    state.game.rounds[0]!.status = 'completed';

    const view = await startRound('game-1', undefined, db, client, () => 0);

    expect(view.roundNumber).toBe(2);
    const round2 = createdRounds.find((round) => round.roundNumber === 2);
    expect(round2).toBeDefined();
    expect(round2!.locationId).toBe(prefetchedLocationId);
    expect(round2!.weatherSnapshotId).toBe(prefetchedSnapshotId);
    // The consume fast path added no weather fetch during round 2 selection.
    expect(round2!.getCurrentCalls).toBe(fetchesAfterPrefetch);
  });

  it('falls back to normal selection when the prefetched snapshot is stale', async () => {
    const state: State = { game: makeGame(), snapshots: new Map() };
    const { db, client, getCurrent, gameUpdate, createdRounds } = buildDb(state);

    await startRound('game-1', undefined, db, client, () => 0);
    await vi.waitFor(() => {
      expect(gameUpdate).toHaveBeenCalled();
    });

    const prefetchedSnapshotId =
      gameUpdate.mock.calls[0][0].data.nextWeatherSnapshotId;
    const fetchesAfterPrefetch = getCurrent.mock.calls.length;

    // Age the cached snapshot beyond the 1h TTL.
    state.snapshots.get(prefetchedSnapshotId)!.fetchedAt = new Date(
      Date.now() - 2 * 60 * 60 * 1000,
    );
    state.game.rounds[0]!.status = 'completed';

    await startRound('game-1', undefined, db, client, () => 0);

    const round2 = createdRounds.find((round) => round.roundNumber === 2);
    expect(round2).toBeDefined();
    expect(round2!.weatherSnapshotId).not.toBe(prefetchedSnapshotId);
    expect(round2!.getCurrentCalls).toBeGreaterThan(fetchesAfterPrefetch);
  });
});