/**
 * Admin routes (B-11). Every /api/admin/* route is guarded by the bearer-auth
 * hook (ADR-0011) — there is no anonymous admin access, ever (B.14).
 */

import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import { requireAdmin } from '../../plugins/auth.js';
import {
  RefreshLocationsResponse,
  WeatherPrefetchResponse,
} from '../../contracts/admin.js';
import { OpenMeteoClient } from '../weather/client.js';
import type { WeatherClient } from '../weather/types.js';
import { refreshLocations, warmWeatherCache } from './service.js';

export interface AdminRoutesOptions {
  adminApiToken: string;
  db?: PrismaClient;
  weatherClient?: WeatherClient;
}

/** Register the admin routes. `db` and `weatherClient` are injectable for tests. */
export function registerAdminRoutes(
  app: FastifyInstance,
  options: AdminRoutesOptions,
): void {
  const db = options.db ?? prisma;
  const weatherClient = options.weatherClient ?? new OpenMeteoClient();

  app.post(
    '/api/admin/locations/refresh',
    {
      onRequest: requireAdmin(options.adminApiToken),
      schema: { response: { 202: RefreshLocationsResponse } },
    },
    async (request, reply) => {
      reply.code(202);
      return refreshLocations(db, { logger: request.log });
    },
  );

  app.post(
    '/api/admin/weather/prefetch',
    {
      onRequest: requireAdmin(options.adminApiToken),
      schema: { response: { 202: WeatherPrefetchResponse } },
    },
    async (_request, reply) => {
      reply.code(202);
      return warmWeatherCache(db, weatherClient);
    },
  );
}