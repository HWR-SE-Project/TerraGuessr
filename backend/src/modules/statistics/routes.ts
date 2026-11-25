import { Type } from '@sinclair/typebox';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { RATE_LIMITS } from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import { settleTimedOutResultsForUser } from '../../domain/settlement.js';
import {
  computePlayerStatistics,
  type StatsDifficultyFilter,
  type StatsModeFilter,
  type StatsPeriod,
} from '../../domain/statistics.js';
import { AuthError } from '../auth/service.js';
import { requireSessionUser } from '../auth/session.js';

const StatsQuery = Type.Object(
  {
    period: Type.Optional(
      Type.Union([
        Type.Literal('7d'),
        Type.Literal('30d'),
        Type.Literal('90d'),
        Type.Literal('6m'),
      ]),
    ),
    mode: Type.Optional(
      Type.Union([
        Type.Literal('all'),
        Type.Literal('solo'),
        Type.Literal('multiplayer'),
      ]),
    ),
    difficulty: Type.Optional(
      Type.Union([
        Type.Literal('all'),
        Type.Literal('easy'),
        Type.Literal('medium'),
        Type.Literal('hard'),
      ]),
    ),
  },
  { additionalProperties: false },
);

const LegacyQuery = Type.Object({
  mode: Type.Union([
    Type.Literal('solo'),
    Type.Literal('multiplayer'),
    Type.Literal('ranked'),
  ]),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});

interface MeStatsQuerystring {
  period?: StatsPeriod;
  mode?: StatsModeFilter;
  difficulty?: StatsDifficultyFilter;
}

type LegacyMode = 'solo' | 'multiplayer' | 'ranked';

export function registerStatisticsRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
): void {
  app.get<{ Querystring: MeStatsQuerystring }>(
    '/api/me/statistics',
    {
      config: { rateLimit: RATE_LIMITS.read },
      schema: { querystring: StatsQuery },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const user = await requireSessionUser(request, db);
      await settleTimedOutResultsForUser(db, user.id);

      const period = request.query.period ?? '30d';
      const mode = request.query.mode ?? 'all';
      const difficulty = request.query.difficulty ?? 'all';

      // All retained rows for this user (bounded naturally by 6-month retention).
      const rows = await db.gameResult.findMany({
        where: { userId: user.id },
        orderBy: [{ createdAt: 'asc' }, { roundNumber: 'asc' }],
        select: {
          id: true,
          mode: true,
          difficulty: true,
          matchId: true,
          roundNumber: true,
          guessLat: true,
          guessLon: true,
          distanceKm: true,
          score: true,
          placeName: true,
          biome: true,
          weather: true,
          temperatureBand: true,
          attemptsUsed: true,
          extraDataUnlocked: true,
          extraDataPointsSpent: true,
          elapsedSeconds: true,
          matchPlacement: true,
          matchPlayerCount: true,
          createdAt: true,
        },
      });

      return computePlayerStatistics(rows, { period, mode, difficulty });
    },
  );

  app.get<{ Querystring: { mode: LegacyMode; limit?: number; offset?: number } }>(
    '/api/statistics',
    {
      schema: { querystring: LegacyQuery },
    },
    async (request) => {
      await requireSessionUser(request, db);
      const { mode } = request.query;
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;
      return {
        mode,
        available: false,
        entries: [],
        total: 0,
        offset,
        limit,
        averageScore: null,
        averageDistanceKm: null,
      };
    },
  );

  app.get('/api/leaderboards/ranked', async (request) => {
    await requireSessionUser(request, db);
    throw new AuthError(503, 'Ranked matchmaking and ratings are not available yet');
  });
}
