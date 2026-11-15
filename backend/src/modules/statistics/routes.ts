import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AuthError } from '../auth/service.js';
import { requireSessionUser } from '../auth/session.js';

const Query = Type.Object({
  mode: Type.Union([Type.Literal('solo'), Type.Literal('multiplayer'), Type.Literal('ranked'), Type.Literal('daily')]),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});
type Mode = 'solo' | 'multiplayer' | 'ranked' | 'daily';

export function registerStatisticsRoutes(app: FastifyInstance, db: PrismaClient = prisma): void {
  app.get<{ Querystring: { mode: Mode; limit?: number; offset?: number } }>('/api/statistics', {
    schema: { querystring: Query },
  }, async (request) => {
    const user = await requireSessionUser(request, db);
    const { mode } = request.query;
    const limit = request.query.limit ?? 20;
    const offset = request.query.offset ?? 0;
    if (mode === 'ranked') return { mode, available: false, entries: [], total: 0, offset, limit, averageScore: null, averageDistanceKm: null };

    if (mode === 'daily') {
      const where = { userId: user.id };
      const [rows, total, averages] = await Promise.all([
        db.dailySubmission.findMany({ where, orderBy: { date: 'desc' }, skip: offset, take: limit, include: { challenge: { include: { location: { select: { name: true, lat: true, lon: true } } } } } }),
        db.dailySubmission.count({ where }),
        db.dailySubmission.aggregate({ where, _avg: { score: true, distanceKm: true } }),
      ]);
      return {
        mode, available: true, total, offset, limit,
        averageScore: averages._avg.score === null ? null : Math.round(averages._avg.score),
        averageDistanceKm: averages._avg.distanceKm,
        entries: rows.map((row) => ({ id: row.id, date: row.date, roundNumber: 1, locationName: row.challenge.location.name, actual: { lat: row.challenge.location.lat, lon: row.challenge.location.lon }, guess: { lat: row.guessLat, lon: row.guessLon }, score: row.score, distanceKm: row.distanceKm, createdAt: row.createdAt.toISOString() })),
      };
    }

    const gameMode = mode === 'solo' ? 'solo' as const : 'challenge' as const;
    const where = { game: { is: { ownerUserId: user.id, mode: gameMode } }, result: { isNot: null } };
    const [rows, total, averages] = await Promise.all([
      db.round.findMany({ where, orderBy: { result: { createdAt: 'desc' } }, skip: offset, take: limit, include: { result: true, location: { select: { name: true } } } }),
      db.round.count({ where }),
      db.result.aggregate({ where: { round: { game: { ownerUserId: user.id, mode: gameMode } } }, _avg: { score: true, distanceKm: true } }),
    ]);
    return {
      mode, available: true, total, offset, limit,
      averageScore: averages._avg.score === null ? null : Math.round(averages._avg.score),
      averageDistanceKm: averages._avg.distanceKm,
      entries: rows.flatMap((row) => row.result ? [{ id: row.result.id, date: row.result.createdAt.toISOString().slice(0, 10), roundNumber: row.roundNumber, locationName: row.location.name, actual: { lat: row.result.actualLat, lon: row.result.actualLon }, guess: { lat: row.result.guessLat, lon: row.result.guessLon }, score: row.result.score, distanceKm: row.result.distanceKm, createdAt: row.result.createdAt.toISOString() }] : []),
    };
  });

  app.get('/api/leaderboards/ranked', async (request) => {
    await requireSessionUser(request, db);
    throw new AuthError(503, 'Ranked matchmaking and ratings are not available yet');
  });
}
