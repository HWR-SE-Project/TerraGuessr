/**
 * Lobby routes (R16). Create/join are anonymous resource creation; leaving and
 * deleting require the client-held lobby token via `X-Lobby-Token` (ADR-0011).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import {
  CreateLobbyBody,
  CreateLobbyResponse,
  JoinLobbyBody,
  JoinLobbyResponse,
  LobbyCodeParams,
  LobbyView,
} from '../../contracts/lobbies.js';
import {
  LobbyNotFoundError,
  createLobby,
  deleteLobby,
  getLobby,
  joinLobby,
  leaveLobby,
} from './service.js';

/** Read the lobby token header; missing/blank is a 404, never a 401. */
function requireLobbyToken(request: FastifyRequest): string {
  const rawToken = request.headers['x-lobby-token'];
  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    throw new LobbyNotFoundError();
  }
  return rawToken;
}

/** Optional token, used by the public read so the host can identify itself. */
function optionalLobbyToken(request: FastifyRequest): string | undefined {
  const rawToken = request.headers['x-lobby-token'];
  return typeof rawToken === 'string' && rawToken.length > 0
    ? rawToken
    : undefined;
}

/** Register the lobby routes. `db` is injectable for tests. */
export function registerLobbiesRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
): void {
  app.post(
    '/api/lobbies',
    {
      // Phase C: anonymous resource creation — bound abuse.
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        body: CreateLobbyBody,
        response: { 201: CreateLobbyResponse },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateLobbyBody;
      const view = await createLobby(body, db);
      reply.code(201);
      return view;
    },
  );

  app.get(
    '/api/lobbies/:code',
    {
      schema: {
        params: LobbyCodeParams,
        response: { 200: LobbyView },
      },
    },
    async (request) => {
      const { code } = request.params as { code: string };
      return getLobby(code, db, optionalLobbyToken(request));
    },
  );

  app.post(
    '/api/lobbies/:code/join',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        params: LobbyCodeParams,
        body: JoinLobbyBody,
        response: { 201: JoinLobbyResponse },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const body = request.body as JoinLobbyBody;
      const view = await joinLobby(code, body, db);
      reply.code(201);
      return view;
    },
  );

  app.post(
    '/api/lobbies/:code/leave',
    {
      schema: { params: LobbyCodeParams },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      await leaveLobby(code, requireLobbyToken(request), db);
      reply.code(204).send();
    },
  );

  app.delete(
    '/api/lobbies/:code',
    {
      schema: { params: LobbyCodeParams },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      await deleteLobby(code, requireLobbyToken(request), db);
      reply.code(204).send();
    },
  );
}
