import './helpers/env.js'; // first: sets DATABASE_URL before any db/prisma import
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import {
  FailingWeatherClient,
  buildTestApp,
  setupDatabase,
  teardownDatabase,
} from './helpers/database.js';

describe('R13 weather fallback (integration)', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;

  beforeAll(async () => {
    prisma = await setupDatabase();
    // Clear cached snapshots from other suites (1h cache would short-circuit).
    // Challenge.round has no cascade (data-model.md), so challenges from other
    // suites must go before the game/round cascade-delete below, exactly like
    // the production purge job (scheduler/purge.ts) already has to.
    await prisma.challenge.deleteMany();
    await prisma.game.deleteMany();
    await prisma.weatherSnapshot.deleteMany();
    // Every candidate's weather fetch fails -> the R13 fallback must surface a
    // 503 SERVICE_UNAVAILABLE, never a 500 crash and never incomplete weather.
    app = buildTestApp(prisma, new FailingWeatherClient());
  });

  afterAll(async () => {
    await app.close();
    await teardownDatabase(prisma);
  });

  it(
    'POST rounds returns 503 SERVICE_UNAVAILABLE when no location has complete weather',
    async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { mode: 'solo', difficulty: 'medium' },
      });
      expect(create.statusCode).toBe(201);
      const { gameId, playerToken } = create.json() as {
        gameId: string;
        playerToken: string;
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/games/' + gameId + '/rounds',
        headers: { 'x-player-token': playerToken },
        payload: {},
      });

      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ error: { code: 'SERVICE_UNAVAILABLE' } });
    },
    45_000,
  );
});
