/**
 * Results routes (B-07). Registered by `registerResultsRoutes` from app.ts.
 * The list is auth'd by game ownership; the single result is auth'd by result
 * ownership (parent game). Actual coordinates are never returned here (R11).
 */

import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import { GameIdParams } from '../../contracts/games.js';
import { ResultIdParams, ResultListItem } from '../../contracts/results.js';
import {
  GameNotFoundError,
  hashPlayerToken,
  requirePlayerToken,
} from '../../plugins/auth.js';
import { getGameResults, getResult } from './service.js';

interface ResultIdRouteParams {
  resultId?: string;
}

/** Auth hook: resolves a result to its parent game and compares token hashes. */
function requireResultOwner(
  db: PrismaClient,
): (
  request: FastifyRequest<{ Params: ResultIdRouteParams }>,
  reply: FastifyReply,
) => Promise<void> {
  return async (request) => {
    const rawToken = request.headers['x-player-token'];
    const resultId = request.params.resultId;

    if (typeof rawToken !== 'string' || rawToken.length === 0 || !resultId) {
      throw new GameNotFoundError();
    }

    const result = await db.result.findUnique({
      where: { id: resultId },
      select: {
        round: { select: { game: { select: { playerTokenHash: true } } } },
      },
    });

    if (
      !result ||
      result.round.game.playerTokenHash !== hashPlayerToken(rawToken)
    ) {
      throw new GameNotFoundError();
    }
  };
}

/** Register the results routes. `db` is injectable for tests. */
export function registerResultsRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
): void {
  app.get(
    '/api/games/:gameId/results',
    {
      onRequest: requirePlayerToken(db),
      schema: {
        params: GameIdParams,
        response: { 200: Type.Array(ResultListItem) },
      },
    },
    async (request) => {
      const { gameId } = request.params as GameIdParams;
      return getGameResults(gameId, db);
    },
  );

  app.get(
    '/api/results/:resultId',
    {
      onRequest: requireResultOwner(db),
      schema: {
        params: ResultIdParams,
        response: { 200: ResultListItem },
      },
    },
    async (request) => {
      const { resultId } = request.params as ResultIdParams;
      return getResult(resultId, db);
    },
  );
}
