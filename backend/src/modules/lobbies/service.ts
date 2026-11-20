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
} from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import { lobbyRulesFor } from '../../domain/lobbyRules.js';
import type { LobbyDifficulty } from '../../domain/lobbyRules.js';
import {
  generatePlayerToken,
  hashPlayerToken,
} from '../../plugins/auth.js';
import type {
  CreateLobbyBody,
  CreateLobbyResponse,
  JoinLobbyResponse,
  LobbyMemberView,
  LobbyView,
} from '../../contracts/lobbies.js';

/** 404 for an unknown, expired, or token-less lobby (ADR-0011). */
export class LobbyNotFoundError extends Error {
  public readonly statusCode = 404;

  public constructor() {
    super('Lobby not found');
    this.name = 'LobbyNotFoundError';
  }
}

/** 409 when a lobby is full or no longer accepting players. */
export class LobbyConflictError extends Error {
  public readonly statusCode = 409;

  public constructor(message: string) {
    super(message);
    this.name = 'LobbyConflictError';
  }
}

/** 403 when a non-host tries to delete the lobby. */
export class LobbyForbiddenError extends Error {
  public readonly statusCode = 403;

  public constructor(message = 'Only the host can delete this lobby') {
    super(message);
    this.name = 'LobbyForbiddenError';
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

/** Prisma unique-constraint violation (code collision on `Lobby.code`). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** Blank/absent names are stored as null (rendered 'Guest' client-side). */
function normalizeDisplayName(name: string | undefined): string | null {
  if (name === undefined) {
    return null;
  }
  const trimmed = name.trim();
  return trimmed.length === 0 ? null : trimmed;
}

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
      joinedAt: member.joinedAt.toISOString(),
    }));

  return {
    lobbyId: lobby.id,
    code: lobby.code,
    difficulty: lobby.difficulty,
    status: lobby.status,
    roundsTotal: lobby.roundsTotal,
    rules: lobbyRulesFor(lobby.difficulty),
    createdAt: lobby.createdAt.toISOString(),
    expiresAt: lobby.expiresAt.toISOString(),
    members,
    youAreHost: callerTokenHash !== null && callerTokenHash === lobby.hostTokenHash,
  };
}

/** Load a live lobby or throw 404 (expired lobbies are treated as gone). */
async function loadLobbyOrThrow(
  code: string,
  db: PrismaClient,
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
          difficulty: input.difficulty as LobbyDifficulty,
          hostTokenHash: playerTokenHash,
          roundsTotal: input.roundsTotal ?? LOBBY_ROUNDS_TOTAL,
          expiresAt,
          members: {
            create: { playerTokenHash, displayName },
          },
        },
        include: { members: true },
      });

      return { lobby: toLobbyView(lobby, playerToken), lobbyToken: playerToken };
    } catch (error) {
      lastError = error;
      if (!isUniqueViolation(error)) {
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
 * Join a waiting lobby and return a fresh lobby token. Joining is idempotent
 * only in the sense that every call creates a new member — a player who loses
 * their token cannot impersonate an existing member.
 */
export async function joinLobby(
  code: string,
  input: { displayName?: string },
  db: PrismaClient = prisma,
): Promise<JoinLobbyResponse> {
  const lobby = await loadLobbyOrThrow(code, db);

  if (lobby.status !== 'waiting') {
    throw new LobbyConflictError('Lobby is no longer accepting players');
  }

  const playerToken = generatePlayerToken();
  const member = await db.lobbyMember.create({
    data: {
      lobbyId: lobby.id,
      playerTokenHash: hashPlayerToken(playerToken),
      displayName: normalizeDisplayName(input.displayName),
    },
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
 * Leave a lobby. While the lobby is still waiting, the host leaving disbands it
 * (and cascades all members). Once a match has started, the host leaving must
 * not end the game: the host is removed and the earliest remaining player is
 * promoted so the lobby can carry on. An ordinary member is removed, along
 * with their match history. An unknown token is a 404.
 */
export async function leaveLobby(
  code: string,
  rawToken: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const lobby = await loadLobbyOrThrow(code, db);
  const playerTokenHash = hashPlayerToken(rawToken);

  if (playerTokenHash === lobby.hostTokenHash) {
    if (lobby.status === 'waiting') {
      await db.lobby.delete({ where: { id: lobby.id } });
      return;
    }

    const remaining = lobby.members.filter(
      (candidate) => candidate.playerTokenHash !== playerTokenHash,
    );
    if (remaining.length === 0) {
      await db.lobby.delete({ where: { id: lobby.id } });
      return;
    }

    const nextHost = remaining[0]!;
    await db.$transaction(async (tx) => {
      await tx.lobbyMember.deleteMany({
        where: { lobbyId: lobby.id, playerTokenHash },
      });
      await tx.lobby.update({
        where: { id: lobby.id },
        data: { hostTokenHash: nextHost.playerTokenHash },
      });
    });
    return;
  }

  const member = lobby.members.find(
    (candidate) => candidate.playerTokenHash === playerTokenHash,
  );
  if (!member) {
    throw new LobbyNotFoundError();
  }

  await db.lobbyMember.delete({ where: { id: member.id } });
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
