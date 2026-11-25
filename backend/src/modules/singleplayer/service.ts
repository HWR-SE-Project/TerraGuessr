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
import { evaluateGuess } from '../../domain/scoring.js';
import { gameRulesFor } from '../../domain/gameRules.js';
import type { GameRules } from '../../domain/gameRules.js';
import {
  applyTimePenalty,
  decideAttempt,
  isDeadlinePassed,
} from '../../domain/roundFlow.js';
import {
  computeScore,
  extraDataAccess,
  formatEvaluatedAttempts,
} from '../../domain/roundView.js';
import { archiveGameResult } from '../../domain/archive.js';
import { purgeExpiredStreetGames } from '../../scheduler/purge.js';
import { buildRoundScene, type RoundScene } from '../../domain/scene.js';
import { catalogLocationProvider } from './provider.js';
import type { PanoramaProvider, PanoramaTarget } from './provider.js';
import {
  placeNameForTarget,
  resolveRoundLocation,
} from './locations.js';
import {
  generateSceneSeed,
  nextExclusions,
  selectRoundWithWeather,
  type IntelligenceLookup,
  type PanoramaLocator,
} from './locationSelection.js';
import {
  buildCandidates,
  findCandidateByPoint,
  resolveSelectionPoint,
  toPublicCandidates,
  type CandidateOption,
  type GuessOrSelectionInput,
} from './candidates.js';
import {
  pendingStreetPrefetch,
  prefetchNextStreetRound,
} from './prefetch.js';
import { PanoramaError } from './providerErrors.js';
import type { GeographicIntelligence } from '../intelligence/contract.js';
import { createIntelligenceProvider } from '../intelligence/service.js';
import {
  redactLockedExtraData,
  withCurrentRoundWeather,
} from '../intelligence/validate.js';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

const EMPTY_PREPARATION = {
  nextRoundNumber: null,
  nextTargetIndex: null,
  nextPanoId: null,
  nextTargetLat: null,
  nextTargetLon: null,
  nextSceneJson: Prisma.DbNull,
  nextWeatherValidUntil: null,
  nextAttemptedIndices: [] as number[],
  nextExhausted: false,
};

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

export type GuessBody =
  | { lat: number; lon: number; final?: boolean }
  | { candidateId: string; final?: boolean };

export interface SingleplayerServiceOptions {
  db?: PrismaClient;
  provider?: PanoramaProvider;
  locate?: PanoramaLocator;
  intelligence?: IntelligenceLookup;
}

export function conflict(message: string): AppError {
  return new AppError(409, message);
}

function roundScene(
  round: Pick<StreetRound, 'sceneJson' | 'placeName' | 'targetIndex' | 'targetLat' | 'targetLon'>,
): RoundScene {
  if (round.sceneJson && typeof round.sceneJson === 'object') {
    return round.sceneJson as unknown as RoundScene;
  }
  const { biome } = resolveRoundLocation(round);
  return buildRoundScene({
    biome,
    weather: { temperatureC: 15, precipitationMm: 0, windSpeedKmh: 10, condition: null },
    lon: round.targetLon,
    seed: generateSceneSeed(),
  });
}

function storedCandidates(round: Pick<StreetRound, 'candidatesJson'>): CandidateOption[] | null {
  return round.candidatesJson as unknown as CandidateOption[] | null;
}

function publicRound(round: RoundWithAttempts, rules: GameRules) {
  const candidates = storedCandidates(round);
  const publicCandidates = toPublicCandidates(candidates);
  const isList = rules.selectionMode === 'list';
  return {
    id: round.id,
    number: round.number,
    scene: roundScene(round),
    ...(publicCandidates ? { candidates: publicCandidates } : {}),
    rules,
    selection:
      isList ||
      round.selectionLat === null ||
      round.selectionLon === null
        ? null
        : { lat: round.selectionLat, lon: round.selectionLon },
    selectedCandidateId: isList
      ? (findCandidateByPoint(candidates, round.selectionLat, round.selectionLon)?.id ?? null)
      : null,
    submittedGuesses: isList
      ? []
      : round.attempts.map((attempt) => ({ lat: attempt.guessLat, lon: attempt.guessLon })),
    submittedCandidateIds: isList
      ? round.attempts.flatMap((attempt) => {
          const match = findCandidateByPoint(candidates, attempt.guessLat, attempt.guessLon);
          return match ? [match.id] : [];
        })
      : [],
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

function result(round: RoundWithAttempts, actual: LatLon) {
  return {
    roundId: round.id,
    number: round.number,
    actual,
    placeName: resolveRoundLocation({
      placeName: round.placeName,
      targetIndex: round.targetIndex,
      targetLat: actual.lat,
      targetLon: actual.lon,
    }).name,
    guess:
      round.guessLat === null || round.guessLon === null
        ? null
        : { lat: round.guessLat, lon: round.guessLon },
    distanceKm: round.distanceKm,
    score: round.score!,
    extraDataPointsSpent: round.additionalDataPointsSpent,
    attempts: formatEvaluatedAttempts(round.attempts),
  };
}

function roundInclude() {
  return {
    attempts: { orderBy: { attemptNumber: 'asc' as const } },
  };
}

/**
 * Build the singleplayer service with injectable dependencies. `db`, the
 * location provider, optional locator, and weather lookup default to production
 * implementations and can be overridden by tests.
 */
export function createSingleplayerService(
  options: SingleplayerServiceOptions = {},
) {
  const db = options.db ?? prisma;
  const provider = options.provider ?? catalogLocationProvider();
  const locate = options.locate;
  const intelligence = options.intelligence ?? createIntelligenceProvider();

  async function resolveRoundPoint(
    round: Pick<StreetRound, 'panoId' | 'targetLat' | 'targetLon'>,
  ): Promise<LatLon> {
    return locate
      ? locate(round.panoId)
      : { lat: round.targetLat, lon: round.targetLon };
  }

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
    timedOut = false,
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
      timedOut,
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
        // session-expiry cleanup. Stores the evaluated guess matching score/distance.
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
          evaluatedGuess: guess,
          distanceKm,
          score,
        });
      }
      return true;
    });
    if (!finalized) return false;
    // R12/R13: ensure the next round's single preparation record is warm
    // (no-op if already prepared with fresh weather while this round was played).
    void prefetchNextStreetRound(
      game.id,
      round.number + 1,
      db,
      provider,
      intelligence,
      locate,
    );
    return true;
  }

  async function settleExpiredRound(
    game: GameWithRounds,
    now = new Date(),
  ): Promise<boolean> {
    const active = game.rounds.find((round) => round.score === null);
    if (!active || !isDeadlinePassed(active.endsAt, now)) return false;
    const actual = await resolveRoundPoint(active);
    return finalizeRound(game, active, actual, true);
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
    await purgeExpiredStreetGames(db, new Date());
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
        .map(async (round) => result(round, await resolveRoundPoint(round))),
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
    let game = await ownedSettled(gameId, token);
    const rules = gameRulesFor(game.difficulty);
    const active = game.rounds.find((r) => r.score === null);
    if (active) return publicRound(active, rules); // Idempotent retry, including response loss.
    // Endless mode: no round cap. Preserve difficulty throughout.
    const nextNumber = game.rounds.length + 1;

    // R12/R13: if background preparation for this round is already in flight,
    // join it instead of issuing duplicate provider/weather calls.
    const pending = pendingStreetPrefetch(game.id, nextNumber);
    if (pending) {
      await pending;
      game = await ownedSettled(gameId, token);
      const activeAfterWait = game.rounds.find((r) => r.score === null);
      if (activeAfterWait) return publicRound(activeAfterWait, rules);
    }

    const usedIndices = game.rounds.map((r) => r.targetIndex);
    async function persistRound(target: PanoramaTarget, scene: RoundScene) {
      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + rules.timeLimitSeconds * 1000);
      const candidates =
        rules.selectionMode === 'list'
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
            placeName: placeNameForTarget(target),
            sceneJson: scene as unknown as Prisma.InputJsonValue,
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
        // R12: start preparing round N+1 while the player plays round N so
        // clicking Next round returns immediately even with slow upstream forecasts.
        void prefetchNextStreetRound(
          game.id,
          nextNumber + 1,
          db,
          provider,
          intelligence,
          locate,
        );
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

    const matchesNext =
      game.nextRoundNumber === nextNumber ||
      (game.nextRoundNumber === null && game.nextPanoId !== null);

    // R13: if prefetch already exhausted all 3 distinct locations for this
    // upcoming round, report 503 immediately without fetching a 4th location.
    // Clear the exhausted record after reporting so an explicit manual retry
    // from the error screen can recover.
    if (matchesNext && game.nextExhausted) {
      await db.streetGame.updateMany({
        where: {
          id: game.id,
          nextRoundNumber: game.nextRoundNumber,
          nextExhausted: true,
        },
        data: EMPTY_PREPARATION,
      });
      throw new PanoramaError(
        'No location with available weather data could be found nearby. Please retry.',
        'WEATHER_UNAVAILABLE',
        game.nextAttemptedIndices,
      );
    }

    // R12 fast path: consume a prepared target if one is ready. The conditional
    // update claims it atomically so concurrent callers never double-consume it.
    let prefetched: PanoramaTarget | undefined;
    let alreadyAttempted: number[] = [];
    if (
      matchesNext &&
      game.nextPanoId != null &&
      game.nextTargetIndex != null &&
      game.nextTargetLat != null &&
      game.nextTargetLon != null
    ) {
      const claimed = await db.streetGame.updateMany({
        where: { id: game.id, nextPanoId: game.nextPanoId },
        data: EMPTY_PREPARATION,
      });
      if (claimed.count) {
        prefetched = {
          panoId: game.nextPanoId,
          targetIndex: game.nextTargetIndex,
          lat: game.nextTargetLat,
          lon: game.nextTargetLon,
        };
        alreadyAttempted = game.nextAttemptedIndices;
        if (
          game.nextSceneJson !== null &&
          game.nextWeatherValidUntil !== null &&
          game.nextWeatherValidUntil.getTime() > Date.now()
        ) {
          return persistRound(
            prefetched,
            game.nextSceneJson as unknown as RoundScene,
          );
        }
      }
    } else if (matchesNext && game.nextAttemptedIndices.length > 0) {
      alreadyAttempted = game.nextAttemptedIndices;
      await db.streetGame.updateMany({
        where: { id: game.id, nextRoundNumber: game.nextRoundNumber },
        data: EMPTY_PREPARATION,
      });
    }

    // R03/R13: only accept a location whose mandatory weather data is
    // available, sharing the 3-location cap with any prior preparation attempts.
    const { target, scene } = await selectRoundWithWeather(
      nextExclusions(usedIndices),
      provider,
      intelligence,
      { locate, prefetched, alreadyAttempted },
    );
    return persistRound(target, scene);
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
    const point = await resolveRoundPoint(round);
    const data = await intelligence(point.lat, point.lon);
    const current = await db.streetRound.findUnique({
      where: { id: round.id },
    });
    if (!current || current.panoId !== round.panoId || current.score !== null)
      throw conflict('The round changed. Request clues for the current round.');
    const rules = gameRulesFor(game.difficulty);
    const { unlocked } = extraDataAccess(
      {
        unlockedAt: current.additionalDataUnlockedAt,
        pointsSpent: current.additionalDataPointsSpent,
      },
      rules,
    );
    return redactLockedExtraData(withCurrentRoundWeather(data), unlocked);
  }

  async function saveSelection(
    gameId: string,
    roundId: string,
    token: string | undefined,
    body: GuessOrSelectionInput,
  ): Promise<void> {
    const game = await ownedSettled(gameId, token);
    const rules = gameRulesFor(game.difficulty);
    const round = game.rounds.find((r) => r.id === roundId);
    if (!round) throw new GameNotFoundError();
    if (round.score !== null) throw conflict('This round has already ended.');
    if (isDeadlinePassed(round.endsAt, new Date()))
      throw conflict('The time limit for this round has expired.');
    const point = resolveSelectionPoint(
      rules.selectionMode,
      body,
      storedCandidates(round),
    );
    await db.streetRound.updateMany({
      where: { id: round.id, score: null },
      data: { selectionLat: point.lat, selectionLon: point.lon },
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
    const { target, scene } = await selectRoundWithWeather(
      nextExclusions(usedIndices),
      provider,
      intelligence,
      { locate },
    );
    const candidates =
      rules.selectionMode === 'list'
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
        placeName: placeNameForTarget(target),
        sceneJson: scene as unknown as Prisma.InputJsonValue,
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
        'The round changed while its scene was loading. Resume the expedition.',
      );
    // Invalidate a prepared next round only if it now conflicts with the replacement.
    const updatedUsed = game.rounds.map((r) =>
      r.id === current.id ? target.targetIndex : r.targetIndex,
    );
    if (
      game.nextRoundNumber === current.number + 1 &&
      game.nextTargetIndex !== null &&
      nextExclusions(updatedUsed).includes(game.nextTargetIndex)
    ) {
      await db.streetGame.updateMany({
        where: { id: game.id, nextRoundNumber: current.number + 1 },
        data: EMPTY_PREPARATION,
      });
      void prefetchNextStreetRound(
        game.id,
        current.number + 1,
        db,
        provider,
        intelligence,
        locate,
      );
    }
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
    const point = resolveSelectionPoint(
      rules.selectionMode,
      guess,
      storedCandidates(round),
    );
    const actual = await resolveRoundPoint(round);
    const latest = await db.streetRound.findUniqueOrThrow({
      where: { id: round.id },
    });
    if (latest.panoId !== round.panoId)
      throw conflict(
        'The panorama changed. Reload the current round before guessing.',
      );
    if (latest.score !== null) {
      if (latest.guessLat === point.lat && latest.guessLon === point.lon) {
        return {
          finalized: true,
          attemptsRemaining: 0,
          result: result(await roundWithAttempts(round.id), actual),
        };
      }
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
    const { distanceKm, score } = evaluateGuess(point, actual);
    try {
      await db.streetRoundAttempt.create({
        data: {
          roundId: round.id,
          attemptNumber: decision.attemptNumber,
          guessLat: point.lat,
          guessLon: point.lon,
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
      data: { selectionLat: point.lat, selectionLon: point.lon },
    });
    if (!decision.finalizes) {
      return {
        finalized: false,
        attemptsRemaining: decision.attemptsRemaining,
      };
    }
    const current = await roundWithAttempts(round.id);
    await finalizeRound(game, current, actual);
    const locked = await roundWithAttempts(round.id);
    return {
      finalized: true,
      attemptsRemaining: 0,
      result: result(locked, actual),
    };
  }

  return {
    available: true,
    serverKeyConfigured: true,
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
