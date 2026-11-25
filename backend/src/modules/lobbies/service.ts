/**
 * Lobby service (R16). A lobby is a waiting room: it owns membership plus the
 * host's difficulty and round count, never location generation. Player
 * identity follows ADR-0011 — the server stores only SHA-256 hashes of
 * client-held tokens.
 */

import { randomInt } from 'node:crypto';

import type { Lobby, LobbyMember, PrismaClient } from '@prisma/client';

import {
  LOBBY_CODE_LENGTH,
  LOBBY_ROUNDS_TOTAL,
  LOBBY_TTL_MS,
  MAX_LOBBY_MEMBERS,
} from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import { gameRulesFor } from '../../domain/gameRules.js';
import type { GameDifficulty } from '../../domain/gameRules.js';
import {
  disambiguateDisplayName,
  normalizeDisplayName,
} from '../../domain/identity.js';
import {
  generatePlayerToken,
  hashPlayerToken,
} from '../../plugins/auth.js';
import { AppError } from '../../plugins/errors.js';
import { isUniqueConstraintError } from '../../db/prismaErrors.js';
import type {
  CreateLobbyBody,
  CreateLobbyResponse,
  JoinLobbyResponse,
  LobbyMemberView,
  LobbyView,
} from '../../contracts/lobbies.js';

/** 404 for an unknown, expired, or token-less lobby (ADR-0011). */
export class LobbyNotFoundError extends AppError {
  public constructor() {
    super(404, 'Lobby not found');
  }
}

/** 409 when a lobby is full or no longer accepting players. */
export class LobbyConflictError extends AppError {
  public constructor(message: string) {
    super(409, message);
  }
}

/** 403 when a non-host tries to delete the lobby. */
export class LobbyForbiddenError extends AppError {
  public constructor(message = 'Only the host can delete this lobby') {
    super(403, message);
  }
}

/** Unambiguous 6-character codes: no 0/O or 1/I confusion when read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_MAX_ATTEMPTS = 5;

/** Generate a 6-character lobby code. `nextInt` is injectable for tests. */
export function generateLobbyCode(
  nextInt: (max: number) => number = (max) => randomInt(max),
): string {
  let code = '';
  for (let index = 0; index < LOBBY_CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[nextInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Blank/absent names are stored as null (rendered 'Guest' client-side). */
type LobbyWithMembers = Lobby & { members: LobbyMember[] };

/** Public projection: hashes never leave the server. */
export function toLobbyView(
  lobby: LobbyWithMembers,
  rawToken?: string,
): LobbyView {
  const callerTokenHash =
    rawToken === undefined ? null : hashPlayerToken(rawToken);
  const members: LobbyMemberView[] = [...lobby.members]
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((member) => ({
      displayName: member.displayName,
      isHost: member.playerTokenHash === lobby.hostTokenHash,
      isYou: callerTokenHash !== null && member.playerTokenHash === callerTokenHash,
      joinedAt: member.joinedAt.toISOString(),
    }));

  return {
    lobbyId: lobby.id,
    code: lobby.code,
    difficulty: lobby.difficulty,
    status: lobby.status,
    roundsTotal: lobby.roundsTotal,
    rules: gameRulesFor(lobby.difficulty),
    createdAt: lobby.createdAt.toISOString(),
    expiresAt: lobby.expiresAt.toISOString(),
    members,
    youAreHost: callerTokenHash !== null && callerTokenHash === lobby.hostTokenHash,
  };
}

/** Load a live lobby or throw 404 (expired lobbies are treated as gone). */
async function loadLobbyOrThrow(
  code: string,
  db: Pick<PrismaClient, 'lobby'>,
): Promise<LobbyWithMembers> {
  const lobby = await db.lobby.findUnique({
    where: { code },
    include: { members: { orderBy: { joinedAt: 'asc' } } },
  });

  if (!lobby || lobby.expiresAt.getTime() <= Date.now()) {
    throw new LobbyNotFoundError();
  }

  return lobby;
}

/**
 * Create a lobby with the host as its first member. The host chooses the
 * difficulty and round count; R5 rules are derived from the difficulty.
 */
export async function createLobby(
  input: CreateLobbyBody,
  db: PrismaClient = prisma,
  userId?: string,
): Promise<CreateLobbyResponse> {
  const playerToken = generatePlayerToken();
  const playerTokenHash = hashPlayerToken(playerToken);
  const displayName = normalizeDisplayName(input.displayName);
  const expiresAt = new Date(Date.now() + LOBBY_TTL_MS);

  let lastError: unknown;
  for (let attempt = 0; attempt < CODE_MAX_ATTEMPTS; attempt += 1) {
    const code = generateLobbyCode();
    try {
      const lobby = await db.lobby.create({
        data: {
          code,
          difficulty: input.difficulty as GameDifficulty,
          hostTokenHash: playerTokenHash,
          roundsTotal: input.roundsTotal ?? LOBBY_ROUNDS_TOTAL,
          expiresAt,
          members: {
            create: {
              playerTokenHash,
              displayName,
              userId: userId ?? null,
            },
          },
        },
        include: { members: true },
      });

      return { lobby: toLobbyView(lobby, playerToken), lobbyToken: playerToken };
    } catch (error) {
      lastError = error;
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new LobbyConflictError('Could not allocate a lobby code');
}

/** Public lobby lookup used by polling clients. */
export async function getLobby(
  code: string,
  db: PrismaClient = prisma,
  rawToken?: string,
): Promise<LobbyView> {
  return toLobbyView(await loadLobbyOrThrow(code, db), rawToken);
}

/**
 * Join a waiting lobby and return a fresh lobby token. Joining is serialized
 * per lobby row so concurrent joins cannot bypass `MAX_LOBBY_MEMBERS` or slip
 * in after the host starts the match.
 */
export async function joinLobby(
  code: string,
  input: { displayName?: string },
  db: PrismaClient = prisma,
  userId?: string,
  maxMembers: number = MAX_LOBBY_MEMBERS,
): Promise<JoinLobbyResponse> {
  const playerToken = generatePlayerToken();
  const playerTokenHash = hashPlayerToken(playerToken);
  const displayName = normalizeDisplayName(input.displayName);

  const { lobby, member } = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Lobby" WHERE "code" = ${code} FOR UPDATE`;
    const existing = await loadLobbyOrThrow(code, tx);

    if (existing.status !== 'waiting') {
      throw new LobbyConflictError('Lobby is no longer accepting players');
    }
    if (existing.members.length >= maxMembers) {
      throw new LobbyConflictError(
        `Lobby is full (maximum ${maxMembers} players)`,
      );
    }

    const uniqueDisplayName = disambiguateDisplayName(
      displayName,
      existing.members.map((candidate) => candidate.displayName),
    );

    const created = await tx.lobbyMember.create({
      data: {
        lobbyId: existing.id,
        playerTokenHash,
        displayName: uniqueDisplayName,
        userId: userId ?? null,
      },
    });

    return { lobby: existing, member: created };
  });

  return {
    lobby: toLobbyView(
      { ...lobby, members: [...lobby.members, member] },
      playerToken,
    ),
    lobbyToken: playerToken,
  };
}

/**
 * Leave a lobby. Serialized per lobby row inside a transaction so concurrent
 * departures can never promote a deleted member as host or fail with P2025.
 */
export async function leaveLobby(
  code: string,
  rawToken: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const playerTokenHash = hashPlayerToken(rawToken);

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Lobby" WHERE "code" = ${code} FOR UPDATE`;
    const lobby = await loadLobbyOrThrow(code, tx);

    if (playerTokenHash === lobby.hostTokenHash) {
      if (lobby.status === 'waiting') {
        await tx.lobby.delete({ where: { id: lobby.id } });
        return;
      }

      const remaining = lobby.members.filter(
        (candidate) => candidate.playerTokenHash !== playerTokenHash,
      );
      if (remaining.length === 0) {
        await tx.lobby.delete({ where: { id: lobby.id } });
        return;
      }

      const nextHost = remaining[0]!;
      await tx.lobbyMember.deleteMany({
        where: { lobbyId: lobby.id, playerTokenHash },
      });
      await tx.lobby.update({
        where: { id: lobby.id },
        data: { hostTokenHash: nextHost.playerTokenHash },
      });
      return;
    }

    const member = lobby.members.find(
      (candidate) => candidate.playerTokenHash === playerTokenHash,
    );
    if (!member) {
      throw new LobbyNotFoundError();
    }

    await tx.lobbyMember.deleteMany({ where: { id: member.id } });
  });
}

/** Delete the lobby; only the host may do so. */
export async function deleteLobby(
  code: string,
  rawToken: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const lobby = await loadLobbyOrThrow(code, db);
  const playerTokenHash = hashPlayerToken(rawToken);

  if (playerTokenHash !== lobby.hostTokenHash) {
    const isMember = lobby.members.some(
      (candidate) => candidate.playerTokenHash === playerTokenHash,
    );
    throw isMember ? new LobbyForbiddenError() : new LobbyNotFoundError();
  }

  await db.lobby.delete({ where: { id: lobby.id } });
}
