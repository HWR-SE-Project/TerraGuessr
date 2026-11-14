import { beforeEach, describe, expect, it, vi } from 'vitest';

const { locationFindMany, locationFindUnique, roundFindMany } = vi.hoisted(() => ({
  locationFindMany: vi.fn(),
  locationFindUnique: vi.fn(),
  roundFindMany: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    location = { findMany: locationFindMany, findUnique: locationFindUnique };
    round = { findMany: roundFindMany };
  },
}));

import { PrismaClient, type Region } from '@prisma/client';
import {
  LocationsService,
  type PoolLocation,
} from '../../src/modules/locations/service.js';

const POOL_SELECT = { id: true, lat: true, lon: true, region: true };

function location(
  id: string,
  region: Region,
  lat: number,
  lon: number,
): PoolLocation {
  return { id, lat, lon, region };
}

describe('LocationsService', () => {
  const prisma = new PrismaClient();
  const service = new LocationsService(prisma);

  beforeEach(() => {
    locationFindMany.mockReset();
    locationFindUnique.mockReset();
    roundFindMany.mockReset();
  });

  it('listPool returns the full pool when no region filter is given', async () => {
    const rows = [
      location('loc-eu-1', 'EUROPE', 48.85, 2.35),
      location('loc-as-1', 'ASIA', 35.68, 139.69),
    ];
    locationFindMany.mockResolvedValue(rows);

    await expect(service.listPool()).resolves.toEqual(rows);
    expect(locationFindMany).toHaveBeenCalledWith({
      where: undefined,
      select: POOL_SELECT,
    });
  });

  it('listPool filters the pool by region', async () => {
    const rows = [location('loc-eu-1', 'EUROPE', 48.85, 2.35)];
    locationFindMany.mockResolvedValue(rows);

    await expect(service.listPool({ region: 'EUROPE' })).resolves.toEqual(rows);
    expect(locationFindMany).toHaveBeenCalledWith({
      where: { region: 'EUROPE' },
      select: POOL_SELECT,
    });
  });

  it('usedLocationIds returns the unique location ids of the game rounds', async () => {
    roundFindMany.mockResolvedValue([
      { locationId: 'loc-1' },
      { locationId: 'loc-2' },
      { locationId: 'loc-1' },
    ]);

    await expect(service.usedLocationIds('game-1')).resolves.toEqual([
      'loc-1',
      'loc-2',
    ]);
    expect(roundFindMany).toHaveBeenCalledWith({
      where: { gameId: 'game-1' },
      select: { locationId: true },
    });
  });

  it('getLocation returns a single location by id', async () => {
    const row = location('loc-eu-1', 'EUROPE', 48.85, 2.35);
    locationFindUnique.mockResolvedValue(row);

    await expect(service.getLocation('loc-eu-1')).resolves.toEqual(row);
    expect(locationFindUnique).toHaveBeenCalledWith({
      where: { id: 'loc-eu-1' },
      select: POOL_SELECT,
    });
  });

  it('getLocation returns null for an unknown id', async () => {
    locationFindUnique.mockResolvedValue(null);

    await expect(service.getLocation('missing')).resolves.toBeNull();
    expect(locationFindUnique).toHaveBeenCalledWith({
      where: { id: 'missing' },
      select: POOL_SELECT,
    });
  });
});
