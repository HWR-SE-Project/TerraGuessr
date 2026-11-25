import type { PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import type { Env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { AuthError, findSessionUser } from './service.js';
import { readCookie, SESSION_COOKIE_NAME } from './cookies.js';

export function readSessionToken(request: FastifyRequest): string | undefined {
  return readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
}

/** Optional owner for a newly created game; guest play remains supported. */
export async function optionalSessionUserId(request: FastifyRequest, db: PrismaClient = prisma): Promise<string | undefined> {
  return (await findSessionUser(db, readSessionToken(request)))?.id;
}

export async function requireSessionUser(request: FastifyRequest, db: PrismaClient = prisma) {
  const user = await findSessionUser(db, readSessionToken(request));
  if (!user) throw new AuthError(401, 'Sign in to continue');
  return user;
}

const allowedOriginsCache = new WeakMap<Env, ReadonlySet<string>>();

function resolveAllowedOrigins(config: Env): ReadonlySet<string> {
  if (config.allowedOrigins) return config.allowedOrigins;
  const cached = allowedOriginsCache.get(config);
  if (cached) return cached;
  const origins = new Set<string>();
  for (const raw of [
    config.appBaseUrl,
    typeof config.corsOrigin === 'string' ? config.corsOrigin : undefined,
  ]) {
    if (!raw) continue;
    origins.add(new URL(raw).origin);
  }
  allowedOriginsCache.set(config, origins);
  return origins;
}

export async function assertSameSiteMutation(request: FastifyRequest, config: Env): Promise<void> {
  if (request.headers['sec-fetch-site'] === 'cross-site') throw new AuthError(403, 'Cross-site account request rejected');
  const origin = request.headers.origin;
  if (!origin) return;
  // `request.host`/`request.protocol` only honor X-Forwarded-* when the app was
  // configured with a matching `trustProxy`, so a client cannot spoof the
  // forwarded headers to make its own origin look same-site.
  const requestOrigin = request.host ? `${request.protocol}://${request.host}` : '';
  const allowed = resolveAllowedOrigins(config);
  if (origin !== requestOrigin && !allowed.has(origin)) throw new AuthError(403, 'Cross-site account request rejected');
}
