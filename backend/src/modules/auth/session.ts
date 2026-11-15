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

export async function assertSameSiteMutation(request: FastifyRequest, config: Env): Promise<void> {
  if (request.headers['sec-fetch-site'] === 'cross-site') throw new AuthError(403, 'Cross-site account request rejected');
  const origin = request.headers.origin;
  if (!origin) return;
  const forwardedHost = request.headers['x-forwarded-host'];
  const forwardedProto = request.headers['x-forwarded-proto'];
  const effectiveHost = typeof forwardedHost === 'string' ? forwardedHost : request.headers.host;
  const effectiveProto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0]!.trim() : request.protocol;
  const requestOrigin = effectiveHost ? `${effectiveProto}://${effectiveHost}` : '';
  const allowed = new Set([config.appBaseUrl, typeof config.corsOrigin === 'string' ? config.corsOrigin : undefined].filter(Boolean).map((value) => new URL(value!).origin));
  if (origin !== requestOrigin && !allowed.has(origin)) throw new AuthError(403, 'Cross-site account request rejected');
}
