/**
 * Player-token authentication (ADR-0011).
 *
 * Anonymous play is addressed by a client-held opaque token. On game creation
 * the server generates a 256-bit token and stores only its SHA-256 hash; the
 * client sends the raw token back on every owned-resource request via the
 * `X-Player-Token` header. Ownership = `sha256(header) === Game.playerTokenHash`;
 * a missing/unknown token is reported as 404 NOT_FOUND (never 401) so the API
 * does not reveal whether the resource exists.
 */

import { createHash, randomBytes } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { prisma } from '../db/prisma.js';

/** Generate a 256-bit opaque player token (base64url), returned to the client once. */
export function generatePlayerToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest of a raw player token (ADR-0011: store/compare hashes only). */
export function hashPlayerToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * 404 NOT_FOUND thrown for a missing game or a missing/wrong token. The message
 * is identical in both cases so the API never reveals resource existence.
 */
export class GameNotFoundError extends Error {
  public readonly statusCode = 404;

  public constructor() {
    super('Game not found');
    this.name = 'GameNotFoundError';
  }
}

interface GameIdParams {
  gameId?: string;
}

/**
 * `onRequest` auth hook for routes carrying a `:gameId` param. Resolves
 * ownership against `Game.playerTokenHash`; missing/unknown token ⇒ 404.
 */
export function requirePlayerToken(
  db: PrismaClient = prisma,
): (
  request: FastifyRequest<{ Params: GameIdParams }>,
  reply: FastifyReply,
) => Promise<void> {
  return async (request) => {
    const rawToken = request.headers['x-player-token'];
    const gameId = request.params.gameId;

    if (typeof rawToken !== 'string' || rawToken.length === 0 || !gameId) {
      throw new GameNotFoundError();
    }

    const game = await db.game.findUnique({ where: { id: gameId } });
    if (!game || game.playerTokenHash !== hashPlayerToken(rawToken)) {
      throw new GameNotFoundError();
    }
  };
}
