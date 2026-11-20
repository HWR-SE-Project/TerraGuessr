import { createIntelligenceProvider } from './modules/intelligence/service.js';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Type } from '@sinclair/typebox';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { registerSingleplayerRoutes } from './modules/singleplayer/routes.js';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { registerChallengesRoutes } from './modules/challenges/routes.js';
import { registerAdminRoutes } from './modules/admin/routes.js';
import { registerGamesRoutes } from './modules/games/routes.js';
import { registerResultsRoutes } from './modules/results/routes.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerDailyRoutes } from './modules/daily/routes.js';
import { registerStatisticsRoutes } from './modules/statistics/routes.js';
import { registerRoundsRoutes } from './modules/rounds/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadEnv();

  const app: FastifyInstance = Fastify({
    logger: { level: config.logLevel },
    // Use the real client address for rate limits and redirect/origin checks.
    // Defaults to false; deployments behind Caddy/nginx set TRUST_PROXY.
    // Fastify's types omit numeric hop counts even though proxy-addr supports them.
    trustProxy: config.trustProxy as boolean | string | string[],
  });

  registerErrorHandler(app);
  // Phase C: opt-in rate limiting (global: false) — only routes that set
  // `config.rateLimit` are limited; see games/challenges routes for the
  // expensive/sensitive ones (anonymous resource creation, Open-Meteo calls).
  // Must be awaited: @fastify/rate-limit reads route config via an `onRoute`
  // hook it installs during its own (async) registration. Routes declared
  // before that hook is actually attached are invisible to it — fire-and-
  // forget registration silently dropped rate limiting on every route.
  await app.register(rateLimit, {
    global: false,
    max: 30,
    timeWindow: '1 minute',
  });
  // Register CORS before routes so its hooks are active for every endpoint.
  // An unset CORS_ORIGIN resolves to false (same-origin only).
  await app.register(cors, { origin: config.corsOrigin });
  registerAuthRoutes(app, { config });
  registerDailyRoutes(app, { config });
  registerStatisticsRoutes(app);
  registerChallengesRoutes(app);
  registerGamesRoutes(app);
  registerSingleplayerRoutes(app, {
    key: config.googleMapsServerKey,
    intelligence: createIntelligenceProvider({
      baseUrl: config.openMeteoBaseUrl,
      apiKey: config.openMeteoApiKey,
    }),
  });
  registerRoundsRoutes(app);
  registerResultsRoutes(app);
  registerAdminRoutes(app, { adminApiToken: config.adminApiToken });

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
