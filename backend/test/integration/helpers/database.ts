/**
 * Integration test database helper (ADR-0012 tier I).
 *
 * Owned by QA (MODULE-OWNERSHIP.md: backend/test/integration/**). Assumes
 * `DATABASE_URL` points to a disposable Postgres (CI `services:` container or
 * the docker compose test stack). Runs `prisma migrate deploy`, seeds a small
 * deterministic location pool, and builds a Fastify app with an injected stub
 * `WeatherClient` so integration tests never hit live Open-Meteo.
 */

import { TEST_DEFAULT_DATABASE_URL } from './env.js'; // first: sets DATABASE_URL eagerly
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';
import type { Region } from '@prisma/client';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { registerErrorHandler } from '../../../src/plugins/errorHandler.js';
import { registerChallengesRoutes } from '../../../src/modules/challenges/routes.js';
import { registerGamesRoutes } from '../../../src/modules/games/routes.js';
import { registerLobbiesRoutes } from '../../../src/modules/lobbies/routes.js';
import { registerRoundsRoutes } from '../../../src/modules/rounds/routes.js';
import { registerResultsRoutes } from '../../../src/modules/results/routes.js';
import type { WeatherClient, WeatherData } from '../../../src/modules/weather/types.js';

const BACKEND_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

const PRISMA_BIN = resolve(
  BACKEND_ROOT,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

/** Default weather served by the stub client (all four R03 fields finite). */
export const DEFAULT_WEATHER: WeatherData = {
  temperatureC: 21.5,
  precipitationMm: 0.4,
  humidityPct: 62,
  windSpeedKmh: 12.7,
  airPressureHpa: 1013.2,
  windDirectionDeg: 245,
  uvIndex: 3.1,
  sunshineDurationSeconds: 7200,
  localTime: '2026-11-17T12:00',
};

export function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? TEST_DEFAULT_DATABASE_URL;
}

/** Idempotently set DATABASE_URL so the Prisma client and CLI both see it. */
export function ensureDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

/**
 * Apply pending migrations via the local Prisma CLI. Retried because parallel
 * vitest workers can race Prisma's migration advisory lock.
 */
export function runMigrations(url: string): void {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      execFileSync(PRISMA_BIN, ['migrate', 'deploy'], {
        cwd: BACKEND_ROOT,
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'ignore',
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

interface SeedLocation {
  id: string;
  lat: number;
  lon: number;
  region: Region;
  name: string | null;
}

/**
 * Small, deterministic, well-separated pool. Every region has at least one
 * location (Easy picks a random region) and the whole pool has >= 8 (Medium
 * list mode). Kept small so the R13 "all weather fails" path stays fast.
 */
export const SEED_LOCATIONS: readonly SeedLocation[] = [
  { id: 'test-eu-1', lat: 52.52, lon: 13.405, region: 'EUROPE', name: null },
  { id: 'test-eu-2', lat: 48.8566, lon: 2.3522, region: 'EUROPE', name: null },
  { id: 'test-eu-3', lat: 40.4168, lon: -3.7038, region: 'EUROPE', name: null },
  { id: 'test-af-1', lat: 30.0, lon: 20.0, region: 'AFRICA', name: null },
  { id: 'test-as-1', lat: 35.0, lon: 100.0, region: 'ASIA', name: null },
  { id: 'test-na-1', lat: 40.0, lon: -100.0, region: 'NORTH_AMERICA', name: null },
  { id: 'test-sa-1', lat: -15.0, lon: -60.0, region: 'SOUTH_AMERICA', name: null },
  { id: 'test-oc-1', lat: -25.0, lon: 135.0, region: 'OCEANIA', name: null },
];

/** Idempotently seed the deterministic pool (safe under parallel workers). */
export async function seedLocations(prisma: PrismaClient): Promise<void> {
  for (const location of SEED_LOCATIONS) {
    await prisma.location.upsert({
      where: { id: location.id },
      create: {
        id: location.id,
        lat: location.lat,
        lon: location.lon,
        region: location.region,
        name: location.name,
        isLand: true,
        source: 'grid',
      },
      update: {
        lat: location.lat,
        lon: location.lon,
        region: location.region,
        name: location.name,
        isLand: true,
        source: 'grid',
      },
    });
  }
}

/** WeatherClient stub: returns finite R03 data, records calls, never hits the network. */
export class StubWeatherClient implements WeatherClient {
  readonly calls: Array<{ lat: number; lon: number }> = [];

  constructor(private readonly data: WeatherData = DEFAULT_WEATHER) {}

  async getCurrent(lat: number, lon: number): Promise<WeatherData> {
    this.calls.push({ lat, lon });
    return { ...this.data };
  }
}

/** WeatherClient that always fails, forcing the R13 fallback → 503. */
export class FailingWeatherClient implements WeatherClient {
  async getCurrent(): Promise<WeatherData> {
    throw new Error('stubbed Open-Meteo failure');
  }
}

/** Build a Fastify app with the given Prisma client + injected weather client. */
export function buildTestApp(
  prisma: PrismaClient,
  weatherClient: WeatherClient,
): FastifyInstance {
  const app = Fastify({ logger: { level: 'silent' } });
  registerErrorHandler(app);
  registerGamesRoutes(app, prisma);
  registerLobbiesRoutes(app, prisma);
  registerRoundsRoutes(app, prisma, weatherClient);
  registerResultsRoutes(app, prisma);
  registerChallengesRoutes(app, prisma);
  return app;
}

/** Migrate + seed, returning a connected Prisma client. */
export async function setupDatabase(): Promise<PrismaClient> {
  const url = ensureDatabaseUrl();
  runMigrations(url);
  const prisma = new PrismaClient();
  await seedLocations(prisma);
  return prisma;
}

export async function teardownDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
}

const FORBIDDEN_ACTUAL_KEYS = new Set(['actualLat', 'actualLon', 'actual']);

/** Deep-scan a value for R04-forbidden keys at any nesting depth. */
export function findLeakedActualKeys(value: unknown): string[] {
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
    } else if (current !== null && typeof current === "object") {
      for (const [key, child] of Object.entries(current)) {
        if (FORBIDDEN_ACTUAL_KEYS.has(key)) {
          leaks.push(path + '.' + key);
        }
        stack.push([path + '.' + key, child]);
      }
    }
  }

  return leaks;
}
