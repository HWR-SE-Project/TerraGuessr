/**
 * Integration test database helper.
 *
 * Assumes `DATABASE_URL` points to a disposable Postgres (CI `services:`
 * container or the docker compose test stack). Runs `prisma migrate deploy`
 * and builds a Fastify app with injected provider doubles so integration tests
 * never hit live Street View or Open-Meteo.
 */

import { TEST_DEFAULT_DATABASE_URL } from './env.js'; // first: sets DATABASE_URL eagerly
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { registerErrorHandler } from '../../../src/plugins/errorHandler.js';
import { createStrictBodySchemaController } from '../../../src/plugins/validation.js';
import { registerLobbiesRoutes } from '../../../src/modules/lobbies/routes.js';
import type { LobbyRouteOptions } from '../../../src/modules/lobbies/routes.js';

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

/** Build a Fastify app with the given Prisma client + injected provider doubles. */
export function buildTestApp(
  prisma: PrismaClient,
  lobbyOptions: LobbyRouteOptions = {},
): FastifyInstance {
  const app = Fastify({
    logger: { level: 'silent' },
    schemaController: createStrictBodySchemaController(),
  });
  registerErrorHandler(app);
  registerLobbiesRoutes(app, prisma, lobbyOptions);
  return app;
}

/** Migrate, returning a connected Prisma client. */
export async function setupDatabase(): Promise<PrismaClient> {
  const url = ensureDatabaseUrl();
  runMigrations(url);
  return new PrismaClient();
}

export async function teardownDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
}
