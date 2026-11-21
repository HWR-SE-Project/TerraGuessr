/**
 * Lobby routes (R16). Create/join are anonymous resource creation; leaving and
 * deleting require the client-held lobby token via `X-Lobby-Token` (ADR-0011).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { readTokenHeader } from '../../plugins/auth.js';
import {
  CreateLobbyBody,
  CreateLobbyResponse,
  JoinLobbyBody,
  JoinLobbyResponse,
  LobbyCodeParams,
  LobbyCoordinates,
  LobbyGuessBody,
  LobbyGuessResponse,
  LobbyMatchResponse,
  LobbyRoundParams,
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
import {
  finishLobbyRound,
  getLobbyMatch,
  getLobbyRoundIntelligence,
  requestLobbyContinue,
  saveLobbySelection,
  startLobbyMatch,
  submitLobbyGuess,
  unlockLobbyExtraData,
} from './match.js';
import { IntelligenceResponse } from '../intelligence/contract.js';
import { optionalSessionUserId } from '../auth/session.js';
import type { IntelligenceLookup } from '../singleplayer/locationSelection.js';
import {
  googlePanoramaProvider,
  type PanoramaProvider,
} from '../singleplayer/provider.js';

/** Read the lobby token header; missing/blank is a 404, never a 401. */
function requireLobbyToken(request: FastifyRequest): string {
  const rawToken = readTokenHeader(request, 'x-lobby-token');
  if (rawToken === undefined) {
    throw new LobbyNotFoundError();
  }
  return rawToken;
}

/** Optional token, used by the public read so the host can identify itself. */
function optionalLobbyToken(request: FastifyRequest): string | undefined {
  return readTokenHeader(request, 'x-lobby-token');
}

export interface LobbyRouteOptions {
  key?: string;
  provider?: PanoramaProvider;
  intelligence?: IntelligenceLookup;
}

/** Register the lobby routes. `db` and provider are injectable for tests. */
export function registerLobbiesRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
  options: LobbyRouteOptions = {},
): void {
  const provider = options.provider ?? googlePanoramaProvider(options.key);
  const intelligence = options.intelligence;

  app.post(
    '/api/lobbies',
    {
      // Phase C: anonymous resource creation — bound abuse.
      config: { rateLimit: RATE_LIMITS.read },
      schema: {
        body: CreateLobbyBody,
        response: { 201: CreateLobbyResponse },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateLobbyBody;
      const view = await createLobby(
        body,
        db,
        await optionalSessionUserId(request, db),
      );
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
      config: { rateLimit: RATE_LIMITS.write },
      schema: {
        params: LobbyCodeParams,
        body: JoinLobbyBody,
        response: { 201: JoinLobbyResponse },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const body = request.body as JoinLobbyBody;
      const view = await joinLobby(
        code,
        body,
        db,
        await optionalSessionUserId(request, db),
      );
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

  app.post(
    '/api/lobbies/:code/start',
    {
      schema: {
        params: LobbyCodeParams,
        response: { 200: LobbyMatchResponse },
      },
    },
    async (request) => {
      const { code } = request.params as { code: string };
      return startLobbyMatch(
        code,
        requireLobbyToken(request),
        db,
        provider,
        intelligence,
      );
    },
  );

  app.get(
    '/api/lobbies/:code/match',
    {
      schema: {
        params: LobbyCodeParams,
        response: { 200: LobbyMatchResponse },
      },
    },
    async (request) => {
      const { code } = request.params as { code: string };
      return getLobbyMatch(
        code,
        requireLobbyToken(request),
        db,
        provider,
        intelligence,
      );
    },
  );

  app.post(
    '/api/lobbies/:code/continue',
    {
      config: { rateLimit: RATE_LIMITS.read },
      schema: {
        params: LobbyCodeParams,
        response: { 200: LobbyMatchResponse },
      },
    },
    async (request) => {
      const { code } = request.params as { code: string };
      return requestLobbyContinue(
        code,
        requireLobbyToken(request),
        db,
        provider,
        intelligence,
      );
    },
  );

  app.post(
    '/api/lobbies/:code/selection',
    {
      config: { rateLimit: RATE_LIMITS.write },
      schema: { params: LobbyCodeParams, body: LobbyCoordinates },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      await saveLobbySelection(
        code,
        requireLobbyToken(request),
        request.body as { lat: number; lon: number },
        db,
      );
      reply.code(204).send();
    },
  );

  app.post(
    '/api/lobbies/:code/rounds/:roundNumber/guess',
    {
      config: { rateLimit: RATE_LIMITS.write },
      schema: {
        params: LobbyRoundParams,
        body: LobbyGuessBody,
        response: { 200: LobbyGuessResponse },
      },
    },
    async (request) => {
      const { code, roundNumber } = request.params as {
        code: string;
        roundNumber: number;
      };
      return submitLobbyGuess(
        code,
        roundNumber,
        requireLobbyToken(request),
        request.body as LobbyGuessBody,
        db,
      );
    },
  );

  app.post(
    '/api/lobbies/:code/rounds/:roundNumber/unlock',
    {
      config: { rateLimit: RATE_LIMITS.standard },
      schema: {
        params: LobbyRoundParams,
        response: { 200: LobbyMatchResponse },
      },
    },
    async (request) => {
      const { code, roundNumber } = request.params as {
        code: string;
        roundNumber: number;
      };
      return unlockLobbyExtraData(
        code,
        roundNumber,
        requireLobbyToken(request),
        db,
        options.provider,
        intelligence,
      );
    },
  );

  app.post(
    '/api/lobbies/:code/rounds/:roundNumber/finish',
    {
      config: { rateLimit: RATE_LIMITS.read },
      schema: {
        params: LobbyRoundParams,
        response: { 200: LobbyGuessResponse },
      },
    },
    async (request) => {
      const { code, roundNumber } = request.params as {
        code: string;
        roundNumber: number;
      };
      return finishLobbyRound(
        code,
        roundNumber,
        requireLobbyToken(request),
        db,
      );
    },
  );

  app.get(
    '/api/lobbies/:code/rounds/:roundNumber/intelligence',
    {
      config: { rateLimit: RATE_LIMITS.standard },
      schema: {
        params: LobbyRoundParams,
        response: { 200: IntelligenceResponse },
      },
    },
    async (request, reply) => {
      const { code, roundNumber } = request.params as {
        code: string;
        roundNumber: number;
      };
      reply.header('Cache-Control', 'private, no-store');
      return getLobbyRoundIntelligence(
        code,
        roundNumber,
        requireLobbyToken(request),
        db,
        intelligence,
      );
    },
  );
}
