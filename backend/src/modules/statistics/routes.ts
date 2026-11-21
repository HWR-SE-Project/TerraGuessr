import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AuthError } from '../auth/service.js';
import { requireSessionUser } from '../auth/session.js';

const Query = Type.Object({
  mode: Type.Union([Type.Literal('solo'), Type.Literal('multiplayer'), Type.Literal('ranked')]),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});
type Mode = 'solo' | 'multiplayer' | 'ranked';

export function registerStatisticsRoutes(app: FastifyInstance, db: PrismaClient = prisma): void {
  app.get<{ Querystring: { mode: Mode; limit?: number; offset?: number } }>('/api/statistics', {
    schema: { querystring: Query },
  }, async (request) => {
    await requireSessionUser(request, db);
    const { mode } = request.query;
    const limit = request.query.limit ?? 20;
    const offset = request.query.offset ?? 0;
    return { mode, available: false, entries: [], total: 0, offset, limit, averageScore: null, averageDistanceKm: null };
  });

  app.get('/api/leaderboards/ranked', async (request) => {
    await requireSessionUser(request, db);
    throw new AuthError(503, 'Ranked matchmaking and ratings are not available yet');
  });
}
