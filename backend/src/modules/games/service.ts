/**
 * Games service (B-05). Creates anonymous games and returns their summary.
 * The raw player token is generated here and returned exactly once; only its
 * SHA-256 hash is persisted (ADR-0011).
 */

import type { PrismaClient, Region } from '@prisma/client';

import { ROUNDS_PER_GAME } from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import {
  GameNotFoundError,
  generatePlayerToken,
  hashPlayerToken,
} from '../../plugins/auth.js';
import type {
  CreateGameBody,
  CreateGameResponse,
  GameSummary,
} from '../../contracts/games.js';

/**
 * Create a game with the given mode/difficulty and return the raw player token
 * exactly once. The database stores only `playerTokenHash = sha256(raw)`.
 */
export async function createGame(
  mode: CreateGameBody['mode'],
  difficulty: CreateGameBody['difficulty'],
  db: PrismaClient = prisma,
  ownerUserId?: string,
  roundsTotal = ROUNDS_PER_GAME,
  geography: 'world' | Region = 'world',
  candidateCount?: number,
): Promise<CreateGameResponse> {
  // Async challenges have one shared location by product rule; only solo
  // sessions accept the configurable 1–20 round count.
  const appliedRoundsTotal = mode === 'solo' ? roundsTotal : 1;
  const geoRegion = mode === 'solo' && geography !== 'world' ? geography : null;
  const appliedCandidateCount = mode === 'solo' ? candidateCount : undefined;
  const playerToken = generatePlayerToken();
  const playerTokenHash = hashPlayerToken(playerToken);

  const game = await db.game.create({
    data: { mode, difficulty, playerTokenHash, ownerUserId, roundsTotal: appliedRoundsTotal, geoRegion, candidateCount: appliedCandidateCount },
  });

  return { gameId: game.id, playerToken, roundsTotal: game.roundsTotal ?? appliedRoundsTotal };
}

/**
 * Return the game summary. Ownership is enforced upstream by the auth hook
 * (`requirePlayerToken`); this only resolves the game and its rounds.
 */
export async function getGameSummary(
  gameId: string,
  db: PrismaClient = prisma,
): Promise<GameSummary> {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { rounds: { orderBy: { roundNumber: 'asc' } } },
  });

  if (!game) {
    throw new GameNotFoundError();
  }

  const roundsPlayed = game.rounds.filter(
    (round) => round.status === 'completed',
  ).length;
  const activeRound = game.rounds.find((round) => round.status === 'active');

  return {
    gameId: game.id,
    mode: game.mode,
    difficulty: game.difficulty,
    status: game.status,
    roundsPlayed,
    roundsTotal: game.roundsTotal ?? ROUNDS_PER_GAME,
    currentRound: activeRound
      ? {
          roundId: activeRound.id,
          roundNumber: activeRound.roundNumber,
          status: activeRound.status,
        }
      : null,
  };
}
