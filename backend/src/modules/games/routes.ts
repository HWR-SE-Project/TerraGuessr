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

/** Register the games routes. `db` is injectable for tests. */
export function registerGamesRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
): void {
  app.post(
    '/api/games',
    {
      schema: {
        body: CreateGameBody,
        response: { 201: CreateGameResponse },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateGameBody;
      const result = await createGame(body.mode, body.difficulty, db);
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
