/**
 * Singleplayer service (R20). Holds the orchestration for the Street View
 * singleplayer flow — loading games, selecting validated locations, scoring
 * guesses and archiving results. Routes stay thin: they validate HTTP input
 * and map service results to responses. Game rules live in `domain/`; the
 * panorama provider and weather lookup are injected so this module is testable
 * without the network.
 */

import { Prisma } from '@prisma/client';
import type { Difficulty, PrismaClient, StreetRound } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import { STREET_GAME_TTL_MS } from '../../config/constants.js';
import {
  generatePlayerToken,
  hashPlayerToken,
  GameNotFoundError,
} from '../../plugins/auth.js';
import { AppError } from '../../plugins/errors.js';
import { isUniqueConstraintError } from '../../db/prismaErrors.js';
import type { LatLon } from '../../domain/distance.js';
import { haversineKm } from '../../domain/distance.js';
import { scoreForDistance } from '../../domain/scoring.js';
import { gameRulesFor } from '../../domain/gameRules.js';
import type { GameRules } from '../../domain/gameRules.js';
import {
  applyTimePenalty,
  decideAttempt,
  isDeadlinePassed,
} from '../../domain/roundFlow.js';
import { computeScore, extraDataAccess } from '../../domain/roundView.js';
import { archiveGameResult } from '../../domain/archive.js';
import {
  googlePanoramaProvider,
  googlePanoramaLocator,
} from './provider.js';
import type { PanoramaProvider, PanoramaTarget } from './provider.js';
import {
  nextExclusions,
  selectValidatedTarget,
  type IntelligenceLookup,
} from './locationSelection.js';
import { buildCandidates } from './candidates.js';
import type { CandidateOption } from './candidates.js';
import { prefetchNextStreetRound } from './prefetch.js';
import type { GeographicIntelligence } from '../intelligence/contract.js';
import { createIntelligenceProvider } from '../intelligence/service.js';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

function parseDifficulty(value: unknown): Difficulty {
  return typeof value === 'string' &&
    (DIFFICULTIES as readonly string[]).includes(value)
    ? (value as Difficulty)
    : 'medium';
}

export type RoundWithAttempts = Prisma.StreetRoundGetPayload<{
  include: { attempts: true };
}>;
export type GameWithRounds = Prisma.StreetGameGetPayload<{
  include: { rounds: { include: { attempts: true } } };
}>;

export interface GuessBody {
  lat: number;
  lon: number;
  final?: boolean;
}

export interface SingleplayerServiceOptions {
  key?: string;
  db?: PrismaClient;
  provider?: PanoramaProvider;
  locate?: (panoId: string) => Promise<LatLon>;
  intelligence?: IntelligenceLookup;
}

export function conflict(message: string): AppError {
  return new AppError(409, message);
}

function publicRound(round: RoundWithAttempts, rules: GameRules) {
  const candidates = round.candidatesJson as unknown as
    | CandidateOption[]
    | null;
  return {
    id: round.id,
    number: round.number,
    panoId: round.panoId,
    ...(candidates && candidates.length ? { candidates } : {}),
    startedAt: round.startedAt?.toISOString() ?? null,
    endsAt: round.endsAt?.toISOString() ?? null,
    attemptsUsed: round.attempts.length,
    attemptsTotal: rules.attemptsPerRound,
    extraData: extraDataAccess(
      {
        unlockedAt: round.additionalDataUnlockedAt,
        pointsSpent: round.additionalDataPointsSpent,
      },
      rules,
    ),
  };
}

function result(round: StreetRound, actual: LatLon) {
  return {
    roundId: round.id,
    number: round.number,
    actual,
    guess:
      round.guessLat === null || round.guessLon === null
        ? null
        : { lat: round.guessLat, lon: round.guessLon },
    distanceKm: round.distanceKm,
    score: round.score!,
    extraDataPointsSpent: round.additionalDataPointsSpent,
  };
}

function roundInclude() {
  return {
    attempts: { orderBy: { attemptNumber: 'asc' as const } },
  };
}

/**
 * Build the singleplayer service with injectable dependencies. `db`, the
 * panorama provider, the locator and the weather lookup default to production
 * implementations and are overridden by tests and the lobby module.
 */
export function createSingleplayerService(
  options: SingleplayerServiceOptions = {},
) {
  const db = options.db ?? prisma;
  const provider = options.provider ?? googlePanoramaProvider(options.key);
  const locate = options.locate ?? googlePanoramaLocator(options.key);
  const intelligence = options.intelligence ?? createIntelligenceProvider();

  async function owned(
    gameId: string,
    token: string | undefined,
  ): Promise<GameWithRounds> {
    if (typeof token !== 'string') throw new GameNotFoundError();
    const game = await db.streetGame.findUnique({
      where: { id: gameId },
      include: {
        rounds: { orderBy: { number: 'asc' }, include: roundInclude() },
      },
    });
    if (
      !game ||
      game.playerTokenHash !== hashPlayerToken(token) ||
      game.expiresAt < new Date()
    )
      throw new GameNotFoundError();
    return game;
  }

  async function finalizeRound(
    game: GameWithRounds,
    round: RoundWithAttempts,
    actual: LatLon,
  ): Promise<boolean> {
    if (round.score !== null) return false;
    const selection =
      round.selectionLat !== null && round.selectionLon !== null
        ? { lat: round.selectionLat, lon: round.selectionLon }
        : null;
    const { guess, distanceKm, score } = computeScore({
      attempts: round.attempts,
      selection,
      actual,
      pointsSpent: round.additionalDataPointsSpent,
    });
    // The archive write is part of the same transaction as the score lock: a
    // failed archive must not leave a completed round permanently unarchived.
    const finalized = await db.$transaction(async (tx) => {
      const updated = await tx.streetRound.updateMany({
        where: { id: round.id, score: null },
        data: {
          guessLat: guess?.lat ?? null,
          guessLon: guess?.lon ?? null,
          distanceKm,
          score,
        },
      });
      if (!updated.count) return false;
      if (game.ownerUserId !== null) {
        // R18: durable account-associated archive, decoupled from the 24h
        // session-expiry cleanup. The coordinates are the *last submitted*
        // attempt, which can differ from the best attempt used for scoring.
        const last = round.attempts[round.attempts.length - 1] ?? null;
        await archiveGameResult(tx, {
          prefix: 'solo',
          roundId: round.id,
          userId: game.ownerUserId,
          mode: 'solo',
          difficulty: game.difficulty,
          sessionId: game.id,
          matchId: game.id,
          roundNumber: round.number,
          actual,
          lastGuess: last ? { lat: last.guessLat, lon: last.guessLon } : null,
          distanceKm,
          score,
        });
      }
      return true;
    });
    if (!finalized) return false;
    // R12: best-effort prefetch of the following round, never awaited.
    void prefetchNextStreetRound(game.id, db, provider, intelligence);
    return true;
  }

  async function settleExpiredRound(
    game: GameWithRounds,
    now = new Date(),
  ): Promise<boolean> {
    const active = game.rounds.find((round) => round.score === null);
    if (!active || !isDeadlinePassed(active.endsAt, now)) return false;
    const actual = await locate(active.panoId);
    return finalizeRound(game, active, actual);
  }

  /** Load the game and resolve an expired active round before serving a view. */
  async function ownedSettled(
    gameId: string,
    token: string | undefined,
  ): Promise<GameWithRounds> {
    let game = await owned(gameId, token);
    if (await settleExpiredRound(game)) game = await owned(gameId, token);
    return game;
  }

  async function roundWithAttempts(id: string): Promise<RoundWithAttempts> {
    return db.streetRound.findUniqueOrThrow({
      where: { id },
      include: roundInclude(),
    });
  }

  async function createGame(input: {
    difficulty?: unknown;
    ownerUserId: string | null;
  }): Promise<{ id: string; playerToken: string }> {
    await db.streetGame.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const playerToken = generatePlayerToken();
    const game = await db.streetGame.create({
      data: {
        playerTokenHash: hashPlayerToken(playerToken),
        ownerUserId: input.ownerUserId,
        difficulty: parseDifficulty(input.difficulty),
        expiresAt: new Date(Date.now() + STREET_GAME_TTL_MS),
      },
    });
    return { id: game.id, playerToken };
  }

  async function getSession(gameId: string, token: string | undefined) {
    const game = await ownedSettled(gameId, token);
    const rules = gameRulesFor(game.difficulty);
    const results = await Promise.all(
      game.rounds
        .filter((r) => r.score !== null)
        .map(async (round) => result(round, await locate(round.panoId))),
    );
    const active = game.rounds.find((r) => r.score === null);
    return {
      id: game.id,
      difficulty: game.difficulty,
      totalScore: results.reduce((sum, r) => sum + r.score, 0),
      activeRound: active ? publicRound(active, rules) : null,
      results,
    };
  }

  async function deleteGame(
    gameId: string,
    token: string | undefined,
  ): Promise<void> {
    // Finalizes ("Ends") the session: the player explicitly chose to stop
    // rather than let it expire naturally. A hard delete cascades StreetRound
    // (see schema) but never touches GameResult, so already-scored
    // authenticated rounds remain in the durable archive (R18) untouched.
    const game = await owned(gameId, token);
    await db.streetGame.delete({ where: { id: game.id } });
  }

  async function startRound(gameId: string, token: string | undefined) {
    const game = await ownedSettled(gameId, token);
    const rules = gameRulesFor(game.difficulty);
    const active = game.rounds.find((r) => r.score === null);
    if (active) return publicRound(active, rules); // Idempotent retry, including response loss.
    // Endless mode: no round cap. Preserve difficulty throughout.
    const usedIndices = game.rounds.map((r) => r.targetIndex);
    const nextNumber = game.rounds.length + 1;
    const startedAt = new Date();
    const endsAt = new Date(
      startedAt.getTime() + rules.timeLimitSeconds * 1000,
    );
    async function persistRound(target: PanoramaTarget) {
      const candidates =
        game.difficulty === 'easy'
          ? buildCandidates(target.targetIndex, usedIndices)
          : null;
      try {
        const round = await db.streetRound.create({
          data: {
            gameId: game.id,
            number: nextNumber,
            panoId: target.panoId,
            targetIndex: target.targetIndex,
            targetLat: target.lat,
            targetLon: target.lon,
            startedAt,
            endsAt,
            ...(candidates
              ? {
                  candidatesJson: candidates as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
          include: roundInclude(),
        });
        return publicRound(round, rules);
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const existing = await db.streetRound.findUniqueOrThrow({
          where: { gameId_number: { gameId: game.id, number: nextNumber } },
          include: roundInclude(),
        });
        return publicRound(existing, rules);
      }
    }
    // R12 fast path: consume a cached prefetched target if one is ready. The
    // conditional update both claims it and prevents a concurrent request from
    // double-consuming the same prefetch.
    if (game.nextPanoId != null) {
      const claimed = await db.streetGame.updateMany({
        where: { id: game.id, nextPanoId: game.nextPanoId },
        data: {
          nextTargetIndex: null,
          nextPanoId: null,
          nextTargetLat: null,
          nextTargetLon: null,
        },
      });
      if (claimed.count)
        return await persistRound({
          panoId: game.nextPanoId,
          targetIndex: game.nextTargetIndex!,
          lat: game.nextTargetLat!,
          lon: game.nextTargetLon!,
        });
    }
    // R03/R13: only accept a location whose mandatory weather data is
    // available, automatically trying another when it is not. R08: once every
    // pool location has been used this session, allow repeats rather than
    // exhausting the pool and failing forever.
    const target = await selectValidatedTarget(
      nextExclusions(usedIndices),
      provider,
      intelligence,
    );
    return persistRound(target);
  }

  async function getRoundIntelligence(
    gameId: string,
    roundId: string,
    token: string | undefined,
  ): Promise<GeographicIntelligence> {
    const game = await ownedSettled(gameId, token);
    const round = game.rounds.find((r) => r.id === roundId);
    if (!round) throw new GameNotFoundError();
    if (round.score !== null)
      throw conflict(
        'Environmental clues are only available for the active round.',
      );
    // Resolve the starting panorama on the server. Street View movement and
    // client-supplied coordinates never control the environmental lookup.
    const point = await locate(round.panoId);
    const data = await intelligence(point.lat, point.lon);
    const current = await db.streetRound.findUnique({
      where: { id: round.id },
    });
    if (!current || current.panoId !== round.panoId || current.score !== null)
      throw conflict('The round changed. Request clues for the current round.');
    return data;
  }

  async function saveSelection(
    gameId: string,
    roundId: string,
    token: string | undefined,
    body: LatLon,
  ): Promise<void> {
    const game = await ownedSettled(gameId, token);
    const round = game.rounds.find((r) => r.id === roundId);
    if (!round) throw new GameNotFoundError();
    if (round.score !== null) throw conflict('This round has already ended.');
    if (isDeadlinePassed(round.endsAt, new Date()))
      throw conflict('The time limit for this round has expired.');
    await db.streetRound.updateMany({
      where: { id: round.id, score: null },
      data: { selectionLat: body.lat, selectionLon: body.lon },
    });
  }

  async function unlockExtraData(
    gameId: string,
    roundId: string,
    token: string | undefined,
  ) {
    const game = await ownedSettled(gameId, token);
    const rules = gameRulesFor(game.difficulty);
    const round = game.rounds.find((r) => r.id === roundId);
    if (!round) throw new GameNotFoundError();
    if (round.score !== null) throw conflict('This round has already ended.');
    if (rules.extraData.mode === 'free') {
      if (round.additionalDataUnlockedAt === null) {
        await db.streetRound.updateMany({
          where: { id: round.id, score: null },
          data: { additionalDataUnlockedAt: new Date() },
        });
      }
    } else if (round.additionalDataUnlockedAt === null) {
      const now = new Date();
      const data =
        rules.extraData.mode === 'points'
          ? {
              additionalDataUnlockedAt: now,
              additionalDataPointsSpent: {
                increment: rules.extraData.cost,
              },
            }
          : {
              additionalDataUnlockedAt: now,
              endsAt: applyTimePenalty(
                round.endsAt ??
                  new Date(now.getTime() + rules.timeLimitSeconds * 1000),
                rules.extraData.cost,
                now,
              ),
            };
      await db.streetRound.updateMany({
        where: { id: round.id, score: null, additionalDataUnlockedAt: null },
        data,
      });
    }
    return publicRound(await roundWithAttempts(round.id), rules);
  }

  async function retryRound(
    gameId: string,
    roundId: string,
    token: string | undefined,
  ) {
    const game = await ownedSettled(gameId, token);
    const rules = gameRulesFor(game.difficulty);
    const current = game.rounds.find((r) => r.id === roundId);
    if (!current) throw new GameNotFoundError();
    if (current.score !== null)
      throw conflict('A scored round cannot be replaced.');
    if (current.attempts.length > 0)
      throw conflict('A round cannot be replaced after a guess was submitted.');
    // R05: never let a retry erase an additional-data cost the player already
    // accepted. The replacement resets the new location's timer, so both the
    // medium point spend and hard time penalty would otherwise disappear for
    // free.
    if (current.additionalDataUnlockedAt !== null)
      throw conflict(
        'A round cannot be replaced after additional data was unlocked.',
      );
    const usedIndices = game.rounds.map((r) => r.targetIndex);
    // R03/R13: a retry (whether triggered by missing coverage or missing
    // weather data) only accepts a location with valid weather too. R08: same
    // pool-exhaustion handling as starting a fresh round.
    const target = await selectValidatedTarget(
      nextExclusions(usedIndices),
      provider,
      intelligence,
    );
    const candidates =
      game.difficulty === 'easy'
        ? buildCandidates(target.targetIndex, usedIndices)
        : null;
    const now = new Date();
    const changed = await db.streetRound.updateMany({
      where: { id: current.id, score: null, panoId: current.panoId },
      data: {
        panoId: target.panoId,
        targetIndex: target.targetIndex,
        targetLat: target.lat,
        targetLon: target.lon,
        selectionLat: null,
        selectionLon: null,
        additionalDataUnlockedAt: null,
        additionalDataPointsSpent: 0,
        startedAt: now,
        endsAt: new Date(now.getTime() + rules.timeLimitSeconds * 1000),
        candidatesJson: candidates
          ? (candidates as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
    if (!changed.count)
      throw conflict(
        'The round changed while its panorama was loading. Resume the expedition.',
      );
    return publicRound(await roundWithAttempts(current.id), rules);
  }

  async function submitGuess(
    gameId: string,
    roundId: string,
    token: string | undefined,
    guess: GuessBody,
  ) {
    const game = await ownedSettled(gameId, token);
    const rules = gameRulesFor(game.difficulty);
    const round = game.rounds.find((r) => r.id === roundId);
    if (!round) throw new GameNotFoundError();
    const actual = await locate(round.panoId);
    const latest = await db.streetRound.findUniqueOrThrow({
      where: { id: round.id },
    });
    if (latest.panoId !== round.panoId)
      throw conflict(
        'The panorama changed. Reload the current round before guessing.',
      );
    if (latest.score !== null) {
      if (latest.guessLat === guess.lat && latest.guessLon === guess.lon)
        return {
          finalized: true,
          attemptsRemaining: 0,
          result: result(latest, actual),
        };
      throw conflict('This round has already ended.');
    }
    const decision = decideAttempt({
      attemptsUsed: round.attempts.length,
      attemptsTotal: rules.attemptsPerRound,
      requestedFinal: guess.final === true,
      finalized: round.score !== null,
      deadlinePassed: isDeadlinePassed(round.endsAt, new Date()),
    });
    if (!decision.allowed) {
      if (decision.reason === 'deadline')
        throw conflict('The time limit for this round has expired.');
      if (decision.reason === 'exhausted')
        throw conflict('No attempts remain for this round.');
      throw conflict('This round has already ended.');
    }
    const distanceKm = haversineKm(guess, actual);
    const score = scoreForDistance(distanceKm);
    try {
      await db.streetRoundAttempt.create({
        data: {
          roundId: round.id,
          attemptNumber: decision.attemptNumber,
          guessLat: guess.lat,
          guessLon: guess.lon,
          distanceKm,
          score,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw conflict(
          'Another guess was submitted at the same time; retry the action.',
        );
      throw error;
    }
    await db.streetRound.updateMany({
      where: { id: round.id, score: null },
      data: { selectionLat: guess.lat, selectionLon: guess.lon },
    });
    if (!decision.finalizes) {
      return {
        finalized: false,
        attemptsRemaining: decision.attemptsRemaining,
      };
    }
    const current = await roundWithAttempts(round.id);
    await finalizeRound(game, current, actual);
    const locked = await db.streetRound.findUniqueOrThrow({
      where: { id: round.id },
    });
    return {
      finalized: true,
      attemptsRemaining: 0,
      result: result(locked, actual),
    };
  }

  return {
    available: Boolean(options.key || options.provider),
    serverKeyConfigured: Boolean(options.key),
    createGame,
    getSession,
    deleteGame,
    startRound,
    getRoundIntelligence,
    saveSelection,
    unlockExtraData,
    retryRound,
    submitGuess,
  };
}

export type SingleplayerService = ReturnType<typeof createSingleplayerService>;
