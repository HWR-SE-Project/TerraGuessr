import type { PrismaClient, Region } from '@prisma/client';

/**
 * A single candidate location in the selection pool (B-04 / R01 / R02).
 *
 * This is the DB-facing view consumed by the pure selection logic in
 * `domain/selection.ts`; only the fields needed to select a round are
 * exposed. Pure sampling/geometry helpers stay in `pool.ts` (D-02).
 */
export interface PoolLocation {
  id: string;
  lat: number;
  lon: number;
  region: Region;
}

/** Optional filter for {@link LocationsService.listPool}. */
export interface ListPoolFilter {
  region?: Region;
}

/** The Prisma projection used to load pool rows. */
const POOL_SELECT = {
  id: true,
  lat: true,
  lon: true,
  region: true,
};

/**
 * DB-facing query layer for the pre-baked location pool (B-04).
 *
 * This class performs no sampling or geometry work: it only reads persisted
 * `Location`/`Round` rows and returns them in the shape the selection domain
 * expects.
 */
export class LocationsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * All pool locations, optionally restricted to a single region.
   *
   * Returns `{ id, lat, lon, region }` rows, matching the `PoolItem` contract
   * used by `selectRound` (ADR-0008).
   */
  async listPool(filter: ListPoolFilter = {}): Promise<PoolLocation[]> {
    return this.prisma.location.findMany({
      where: filter.region ? { region: filter.region } : undefined,
      select: POOL_SELECT,
    });
  }

  /**
   * The location ids already used by the rounds of `gameId`, with duplicates
   * removed (R02: a location may not be selected twice in the same game).
   */
  async usedLocationIds(gameId: string): Promise<string[]> {
    const rounds = await this.prisma.round.findMany({
      where: { gameId },
      select: { locationId: true },
    });

    return [...new Set(rounds.map((round) => round.locationId))];
  }

  /** A single location by id, or `null` when it does not exist. */
  async getLocation(id: string): Promise<PoolLocation | null> {
    return this.prisma.location.findUnique({
      where: { id },
      select: POOL_SELECT,
    });
  }
}
