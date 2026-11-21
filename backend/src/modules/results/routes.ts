import { Type } from '@sinclair/typebox';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { prisma } from '../../db/prisma.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { requireSessionUser } from '../auth/session.js';
import {
  Coordinates,
  Difficulty as DifficultyLevel,
} from '../../contracts/shared.js';

const GameMode = Type.Union([Type.Literal('solo'), Type.Literal('multiplayer')]);
const ResultRow = Type.Object(
  {
    id: Type.String(),
    roundNumber: Type.Integer(),
    actual: Coordinates,
    guess: Type.Union([Coordinates, Type.Null()]),
    distanceKm: Type.Union([Type.Number(), Type.Null()]),
    score: Type.Integer(),
    createdAt: Type.String(),
  },
  { additionalProperties: false },
);
const Match = Type.Object(
  {
    matchId: Type.String(),
    sessionId: Type.String(),
    mode: GameMode,
    difficulty: DifficultyLevel,
    totalScore: Type.Integer(),
    results: Type.Array(ResultRow),
  },
  { additionalProperties: false },
);
const Response = Type.Object(
  {
    matches: Type.Array(Match),
    total: Type.Integer(),
    offset: Type.Integer(),
    limit: Type.Integer(),
  },
  { additionalProperties: false },
);
const Query = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

interface ResultQuery {
  limit?: number;
  offset?: number;
}

/**
 * R18 result history for the signed-in player. The durable archive is only
 * readable through the caller's own account; there is no cross-player lookup.
 * Matches are grouped by `matchId`, which is stable across lobby rematches.
 */
export function registerResultsRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
): void {
  app.get<{ Querystring: ResultQuery }>(
    '/api/me/results',
    {
      config: { rateLimit: RATE_LIMITS.read },
      schema: {
        querystring: Query,
        response: { 200: Response },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const user = await requireSessionUser(request, db);
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;

      const [groups, counted] = await Promise.all([
        db.gameResult.groupBy({
          by: ['matchId'],
          where: { userId: user.id },
          _max: { createdAt: true },
          orderBy: { _max: { createdAt: 'desc' } },
          take: limit,
          skip: offset,
        }),
        db.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(DISTINCT "matchId")::int AS count
          FROM "GameResult"
          WHERE "userId" = ${user.id}
        `,
      ]);
      const matchIds = groups.map((group) => group.matchId);
      const rows =
        matchIds.length === 0
          ? []
          : await db.gameResult.findMany({
              where: { userId: user.id, matchId: { in: matchIds } },
              orderBy: [{ roundNumber: 'asc' }, { createdAt: 'asc' }],
            });
      const byMatch = new Map<string, typeof rows>();
      for (const row of rows) {
        const list = byMatch.get(row.matchId);
        if (list) list.push(row);
        else byMatch.set(row.matchId, [row]);
      }
      const matches = matchIds.flatMap((matchId) => {
        const results = byMatch.get(matchId);
        const first = results?.[0];
        if (!results || !first) return [];
        return [
          {
            matchId,
            sessionId: first.sessionId,
            mode: first.mode,
            difficulty: first.difficulty,
            totalScore: results.reduce((sum, result) => sum + result.score, 0),
            results: results.map((result) => ({
              id: result.id,
              roundNumber: result.roundNumber,
              actual: { lat: result.actualLat, lon: result.actualLon },
              guess:
                result.guessLat === null || result.guessLon === null
                  ? null
                  : { lat: result.guessLat, lon: result.guessLon },
              distanceKm: result.distanceKm,
              score: result.score,
              createdAt: result.createdAt.toISOString(),
            })),
          },
        ];
      });

      return {
        matches,
        total: counted[0]?.count ?? 0,
        offset,
        limit,
      };
    },
  );
}
