/**
 * Games routes (B-05). Registered by `registerGamesRoutes` from app.ts.
 * Uses the ADR-0009 error envelope via the global error handler for non-2xx.
 */

import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import { requirePlayerToken } from '../../plugins/auth.js';
import {
  CreateGameBody,
  CreateGameResponse,
  GameIdParams,
  GameSummary,
} from '../../contracts/games.js';
import { createGame, getGameSummary } from './service.js';
import { optionalSessionUserId } from '../auth/session.js';

/** Register the games routes. `db` is injectable for tests. */
export function registerGamesRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
): void {
  app.post(
    '/api/games',
    {
      // Phase C: anonymous resource creation — bound abuse (global rate-limit
      // plugin is registered opt-in only; see app.ts).
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        body: CreateGameBody,
        response: { 201: CreateGameResponse },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateGameBody;
      const ownerUserId = await optionalSessionUserId(request, db);
      const result = await createGame(body.mode, body.difficulty, db, ownerUserId, body.roundsTotal, body.geography, body.candidateCount, body.attemptsPerRound, body.additionalDataUnlockMode, body.additionalDataUnlockCost);
      reply.code(201);
      return result;
    },
  );

  app.get(
    '/api/games/:gameId',
    {
      onRequest: requirePlayerToken(db),
      schema: {
        params: GameIdParams,
        response: { 200: GameSummary },
      },
    },
    async (request) => {
      const { gameId } = request.params as GameIdParams;
      return getGameSummary(gameId, db);
    },
  );
}
