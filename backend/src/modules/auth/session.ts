import type { PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { findSessionUser } from './service.js';
import { readCookie, SESSION_COOKIE_NAME } from './cookies.js';

export function readSessionToken(request: FastifyRequest): string | undefined {
  return readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
}

/** Optional owner for a newly created game; guest play remains supported. */
export async function optionalSessionUserId(request: FastifyRequest, db: PrismaClient = prisma): Promise<string | undefined> {
  return (await findSessionUser(db, readSessionToken(request)))?.id;
}
