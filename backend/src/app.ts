import cors from '@fastify/cors';
import { Type } from '@sinclair/typebox';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { registerAdminRoutes } from './modules/admin/routes.js';
import { registerGamesRoutes } from './modules/games/routes.js';
import { registerResultsRoutes } from './modules/results/routes.js';
import { registerRoundsRoutes } from './modules/rounds/routes.js';

export function buildApp(): FastifyInstance {
  const config = loadEnv();

  const app: FastifyInstance = Fastify({
    logger: { level: config.logLevel },
  });

  registerErrorHandler(app);
  registerGamesRoutes(app);
  registerRoundsRoutes(app);
  registerResultsRoutes(app);
  registerAdminRoutes(app, { adminApiToken: config.adminApiToken });

  void app.register(cors, { origin: config.corsOrigin });

  app.get(
    '/api/health',
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.Literal('ok'),
            time: Type.String(),
          }),
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      time: new Date().toISOString(),
    }),
  );

  return app;
}
