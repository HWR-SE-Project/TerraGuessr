import { randomUUID } from 'node:crypto';

import type { Prisma } from '@prisma/client';
import type {
  Lobby,
  LobbyMember,
  LobbyRound,
  LobbyRoundAttempt,
  LobbyRoundMemberState,
  LobbyRoundResult,
  PrismaClient,
} from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import {
  LOBBY_CONTINUE_WINDOW_MS,
  LOBBY_ROUND_REVIEW_MS,
  LOBBY_TTL_MS,
} from '../../config/constants.js';
import type { LatLon } from '../../domain/distance.js';
import { gameRulesFor } from '../../domain/gameRules.js';
import type { GameRules } from '../../domain/gameRules.js';
import {
  applyTimePenalty,
  decideAttempt,
  isDeadlinePassed,
} from '../../domain/roundFlow.js';
import { evaluateGuess } from '../../domain/scoring.js';
import {
  computeScore,
  extraDataAccess,
  formatEvaluatedAttempts,
} from '../../domain/roundView.js';
import { archiveGameResult } from '../../domain/archive.js';
import { buildRoundScene, type RoundScene } from '../../domain/scene.js';
import { hashPlayerToken } from '../../plugins/auth.js';
import { AppError } from '../../plugins/errors.js';
import { isUniqueConstraintError } from '../../db/prismaErrors.js';
import type {
  LobbyGuessBody,
  LobbyGuessResponse,
  LobbyMatchResponse,
  LobbyMatchView,
} from '../../contracts/lobbies.js';
import type { GeographicIntelligence } from '../intelligence/contract.js';
import {
  redactLockedExtraData,
  withCurrentRoundWeather,
} from '../intelligence/validate.js';
import {
  buildCandidates,
  findCandidateByPoint,
  resolveSelectionPoint,
  toPublicCandidates,
  type CandidateOption,
  type GuessOrSelectionInput,
} from '../singleplayer/candidates.js';
import {
  placeNameForTarget,
  resolveRoundLocation,
} from '../singleplayer/locations.js';
import {
  generateSceneSeed,
  selectRoundWithWeather,
  type IntelligenceLookup,
  type PanoramaLocator,
} from '../singleplayer/locationSelection.js';
import type { PanoramaProvider, PanoramaTarget } from '../singleplayer/provider.js';
import { PanoramaError } from '../singleplayer/providerErrors.js';
import {
  LobbyConflictError,
  LobbyForbiddenError,
  LobbyNotFoundError,
  toLobbyView,
} from './service.js';

export class LobbyUnavailableError extends AppError {
  public constructor(message: string, code?: string) {
    super(503, message, code);
  }
}

type MatchRound = LobbyRound & {
  attempts: LobbyRoundAttempt[];
  results: LobbyRoundResult[];
  memberStates: LobbyRoundMemberState[];
};

type MatchLobby = Lobby & {
  members: LobbyMember[];
  rounds: MatchRound[];
};

function roundCandidates(round: MatchRound): CandidateOption[] | null {
  return round.candidatesJson as unknown as CandidateOption[] | null;
}

/** Per-player extra-data state for this round (R05/R16). */
function memberState(
  round: MatchRound,
  memberId: string,
): LobbyRoundMemberState | null {
  return round.memberStates.find((state) => state.memberId === memberId) ?? null;
}

/** The player's own deadline, shortened only by their hard-mode unlock. */
function roundDeadline(round: MatchRound, member: LobbyMember): Date | null {
  return memberState(round, member.id)?.endsAt ?? round.endsAt;
}

function roundScene(round: MatchRound): RoundScene {
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

function publicRound(round: MatchRound, rules: GameRules, member: LobbyMember) {
  const candidates = toPublicCandidates(roundCandidates(round));
  const state = memberState(round, member.id);
  return {
    id: round.id,
    number: round.number,
    scene: roundScene(round),
    ...(candidates ? { candidates } : {}),
    endsAt: round.endsAt?.toISOString() ?? null,
    attemptsUsed: round.attempts.filter(
      (attempt) => attempt.memberId === member.id,
    ).length,
    attemptsTotal: rules.attemptsPerRound,
    extraData: extraDataAccess(
      {
        unlockedAt: state?.extraDataUnlockedAt ?? null,
        pointsSpent: state?.extraDataPointsSpent ?? 0,
      },
      rules,
    ),
  };
}

function answerForGuess(round: MatchRound, result: LobbyRoundResult): string | null {
  if (result.guessLat === null || result.guessLon === null) return null;
  return (
    roundCandidates(round)?.find(
      (candidate) =>
        candidate.lat === result.guessLat && candidate.lon === result.guessLon,
    )?.name ?? null
  );
}

/**
 * Participant guesses are published together when the shared round closes.
 */
function participantGuesses(
  lobby: MatchLobby,
  round: MatchRound,
  viewer: LobbyMember,
) {
  return lobby.members.flatMap((member) => {
    const result = round.results.find(
      (candidate) => candidate.memberId === member.id,
    );
    if (!result) return [];
    return [
      {
        memberId: member.id,
        displayName: member.displayName,
        isHost: member.playerTokenHash === lobby.hostTokenHash,
        isYou: member.id === viewer.id,
        guess:
          result.guessLat === null || result.guessLon === null
            ? null
            : { lat: result.guessLat, lon: result.guessLon },
        distanceKm: result.distanceKm,
        score: result.score,
        answer: answerForGuess(round, result),
      },
    ];
  });
}

function resultPoint(round: MatchRound, result: LobbyRoundResult): LatLon {
  return {
    lat: result.actualLat ?? round.targetLat,
    lon: result.actualLon ?? round.targetLon,
  };
}

async function roundPoint(round: MatchRound, locate?: PanoramaLocator): Promise<LatLon> {
  const firstResult = round.results[0];
  if (firstResult) return resultPoint(round, firstResult);
  return locate ? locate(round.panoId) : { lat: round.targetLat, lon: round.targetLon };
}

function resultView(
  lobby: MatchLobby,
  round: MatchRound,
  result: LobbyRoundResult,
  viewer: LobbyMember,
) {
  const viewerAttempts = round.attempts.filter(
    (attempt) => attempt.memberId === viewer.id,
  );
  const actual = resultPoint(round, result);
  return {
    roundNumber: round.number,
    score: result.score,
    distanceKm: result.distanceKm,
    guess:
      result.guessLat === null || result.guessLon === null
        ? null
        : { lat: result.guessLat, lon: result.guessLon },
    actual,
    placeName: resolveRoundLocation({
      placeName: round.placeName,
      targetIndex: round.targetIndex,
      targetLat: actual.lat,
      targetLon: actual.lon,
    }).name,
    attemptsUsed: result.attemptsUsed,
    extraDataPointsSpent: result.extraDataPointsSpent,
    attempts: formatEvaluatedAttempts(viewerAttempts),
    guesses: participantGuesses(lobby, round, viewer),
  };
}

async function loadMatchLobby(
  code: string,
  db: PrismaClient,
): Promise<MatchLobby> {
  const lobby = await db.lobby.findUnique({
    where: { code },
    include: {
      members: { orderBy: { joinedAt: 'asc' } },
      rounds: {
        orderBy: { number: 'asc' },
        include: { attempts: true, results: true, memberStates: true },
      },
    },
  });

  if (!lobby || lobby.expiresAt.getTime() <= Date.now()) {
    throw new LobbyNotFoundError();
  }

  return lobby;
}

function memberForToken(lobby: MatchLobby, rawToken: string): LobbyMember {
  const hash = hashPlayerToken(rawToken);
  const member = lobby.members.find(
    (candidate) => candidate.playerTokenHash === hash,
  );
  if (!member) {
    throw new LobbyNotFoundError();
  }
  return member;
}

function assertHost(lobby: MatchLobby, member: LobbyMember): void {
  if (member.playerTokenHash !== lobby.hostTokenHash) {
    throw new LobbyForbiddenError('Only the host can start this match');
  }
}

async function finalizeMemberRound(
  db: PrismaClient,
  round: MatchRound,
  member: LobbyMember,
  attempts: LobbyRoundAttempt[],
  actual: LatLon,
  timedOut = false,
): Promise<LobbyRoundResult> {
  // Read the latest per-player state so a concurrent unlock is still charged.
  const state = await db.lobbyRoundMemberState.findUnique({
    where: {
      roundId_memberId: { roundId: round.id, memberId: member.id },
    },
  });
  const extraDataPointsSpent = state?.extraDataPointsSpent ?? 0;
  const selection =
    member.selectionLat !== null && member.selectionLon !== null
      ? { lat: member.selectionLat, lon: member.selectionLon }
      : null;
  const { guess, distanceKm, score } = computeScore({
    attempts,
    selection,
    actual,
    pointsSpent: extraDataPointsSpent,
    timedOut,
  });

  // R04/R16: do not write to GameResult here — signed-in results are archived
  // atomically when the shared review opens so account history cannot leak the
  // target location before all players finish.
  return db.lobbyRoundResult.upsert({
    where: {
      roundId_memberId: { roundId: round.id, memberId: member.id },
    },
    create: {
      roundId: round.id,
      memberId: member.id,
      actualLat: actual.lat,
      actualLon: actual.lon,
      guessLat: guess?.lat ?? null,
      guessLon: guess?.lon ?? null,
      distanceKm,
      score,
      attemptsUsed: attempts.length,
      extraDataPointsSpent,
    },
    update: {},
  });
}

// The review and the first poll after it share any pending preparation work.
const nextRoundPreparations = new Map<string, Promise<void>>();

function prepareFollowingRound(
  lobby: MatchLobby,
  nextRoundId: string,
  reviewEndsAt: Date,
  db: PrismaClient,
  provider: PanoramaProvider,
  intelligence: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<void> {
  const pending = nextRoundPreparations.get(nextRoundId);
  if (pending) return pending;

  async function prepare() {
    const next = await db.lobbyRound.findUnique({ where: { id: nextRoundId } });
    const validAt = new Date(Math.max(Date.now(), reviewEndsAt.getTime()));
    if (!next || next.startedAt || (next.weatherValidUntil && next.weatherValidUntil >= validAt)) return;
    if (next.weatherExhausted) {
      throw new PanoramaError(
        'No location with available weather data could be found nearby. Please retry.',
        'WEATHER_UNAVAILABLE',
        next.weatherAttemptedIndices,
      );
    }

    const used = lobby.rounds
      .filter((round) => round.id !== nextRoundId)
      .map((round) => round.targetIndex);
    const planned = {
      panoId: next.panoId,
      targetIndex: next.targetIndex,
      lat: next.targetLat,
      lon: next.targetLon,
    };
    let prepared: Awaited<ReturnType<typeof selectRoundWithWeather>>;
    try {
      prepared = await selectRoundWithWeather(
        used,
        provider,
        intelligence,
        {
          prefetched: planned,
          locate,
          validAt,
          alreadyAttempted: next.weatherAttemptedIndices,
        },
      );
    } catch (error) {
      if (error instanceof PanoramaError && error.code === 'WEATHER_UNAVAILABLE') {
        await db.lobbyRound.updateMany({
          where: {
            id: next.id,
            startedAt: null,
            lobby: { matchId: lobby.matchId, status: 'playing', currentRound: lobby.currentRound },
          },
          data: {
            weatherAttemptedIndices: [
              ...(error.attemptedIndices ?? next.weatherAttemptedIndices),
            ],
            weatherExhausted: true,
          },
        });
      }
      throw error;
    }
    const { target, scene, weatherValidUntil, attemptedIndices } = prepared;
    const rules = gameRulesFor(lobby.difficulty);
    await db.lobbyRound.updateMany({
      where: {
        id: next.id,
        startedAt: null,
        lobby: { matchId: lobby.matchId, status: 'playing', currentRound: lobby.currentRound },
        OR: [{ weatherValidUntil: null }, { weatherValidUntil: { lt: validAt } }],
      },
      data: {
        panoId: target.panoId,
        targetIndex: target.targetIndex,
        targetLat: target.lat,
        targetLon: target.lon,
        placeName: placeNameForTarget(target),
        sceneJson: scene as unknown as Prisma.InputJsonValue,
        weatherValidUntil,
        weatherAttemptedIndices: attemptedIndices,
        weatherExhausted: false,
        ...(target !== planned && rules.selectionMode === 'list'
          ? { candidatesJson: buildCandidates(target.targetIndex, used) as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  const preparation = prepare().finally(() => { nextRoundPreparations.delete(nextRoundId); });
  nextRoundPreparations.set(nextRoundId, preparation);
  return preparation;
}

interface LobbyProgressResult {
  mutated: boolean;
  unavailable?: LobbyUnavailableError;
}

async function ensureLobbyProgress(
  lobby: MatchLobby,
  db: PrismaClient,
  now: Date,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<LobbyProgressResult> {
  if (lobby.status !== 'playing') return { mutated: false };

  const round = lobby.rounds.find((candidate) => candidate.number === lobby.currentRound);
  if (!round) return { mutated: false };
  const nextRound = lobby.rounds.find((candidate) => candidate.number === round.number + 1);
  const where = {
    id: lobby.id,
    matchId: lobby.matchId,
    status: 'playing' as const,
    currentRound: round.number,
  };

  if (!round.reviewEndsAt) {
    const completed = new Set(round.results.map((result) => result.memberId));
    const pending = lobby.members.filter((member) => !completed.has(member.id));
    const timedOut = pending.filter((member) => isDeadlinePassed(roundDeadline(round, member), now));
    let mutated = false;
    // Hard-mode clue penalties can expire a single player's clock before the shared round.
    if (timedOut.length > 0) {
      const actual = await roundPoint(round, locate);
      for (const member of timedOut) {
        await finalizeMemberRound(
          db, round, member, round.attempts.filter((attempt) => attempt.memberId === member.id),
          actual, true,
        );
      }
      mutated = true;
    }
    if (timedOut.length !== pending.length) return { mutated };

    const reviewEndsAt = new Date(Date.now() + LOBBY_ROUND_REVIEW_MS);
    const opened = await db.$transaction(async (tx) => {
      const claim = await tx.lobbyRound.updateMany({
        where: { id: round.id, reviewEndsAt: null, lobby: where },
        data: { reviewEndsAt },
      });
      if (!claim.count) return false;

      // R04/R16/R18: archive signed-in players' results atomically with the
      // shared reveal so account history never leaks the target early.
      const results = await tx.lobbyRoundResult.findMany({
        where: { roundId: round.id },
        include: { member: { select: { userId: true } } },
      });
      for (const result of results) {
        if (result.member.userId === null) continue;
        await archiveGameResult(tx, {
          prefix: 'lobby',
          roundId: result.id,
          userId: result.member.userId,
          mode: 'multiplayer',
          difficulty: lobby.difficulty,
          sessionId: round.lobbyId,
          matchId: lobby.matchId,
          roundNumber: round.number,
          actual: resultPoint(round, result),
          evaluatedGuess:
            result.guessLat !== null && result.guessLon !== null
              ? { lat: result.guessLat, lon: result.guessLon }
              : null,
          distanceKm: result.distanceKm,
          score: result.score,
        });
      }
      return true;
    });
    if (opened && nextRound && provider && intelligence) {
      // The next poll can retry preparation if this request fails.
      void prepareFollowingRound(lobby, nextRound.id, reviewEndsAt, db, provider, intelligence, locate)
        .catch(() => {});
    }
    return { mutated: true };
  }

  if (!isDeadlinePassed(round.reviewEndsAt, now)) return { mutated: false };
  if (!nextRound) {
    await db.lobby.updateMany({ where, data: { status: 'finished', finishedAt: now } });
    return { mutated: true };
  }
  if (!provider || !intelligence) {
    return {
      mutated: false,
      unavailable: new LobbyUnavailableError('Geographic data is not configured on this server.'),
    };
  }

  try {
    await prepareFollowingRound(lobby, nextRound.id, round.reviewEndsAt, db, provider, intelligence, locate);
    const startedAt = new Date();
    const rules = gameRulesFor(lobby.difficulty);
    await db.$transaction(async (tx) => {
      const claimed = await tx.lobby.updateMany({
        where,
        data: { currentRound: nextRound.number, startedAt, finishedAt: null },
      });
      if (!claimed.count) return;
      const started = await tx.lobbyRound.updateMany({
        where: { id: nextRound.id, startedAt: null, weatherValidUntil: { gte: startedAt } },
        data: { startedAt, endsAt: new Date(startedAt.getTime() + rules.timeLimitSeconds * 1000) },
      });
      if (!started.count) {
        throw new LobbyUnavailableError('The next round’s weather expired. Preparing a fresh location.', 'WEATHER_UNAVAILABLE');
      }
      await tx.lobbyMember.updateMany({
        where: { lobbyId: lobby.id },
        data: { selectionLat: null, selectionLon: null },
      });
    });
    return { mutated: true };
  } catch (error) {
    if (error instanceof LobbyUnavailableError) return { mutated: true, unavailable: error };
    if (error instanceof PanoramaError) {
      return { mutated: true, unavailable: new LobbyUnavailableError(error.reason, error.code) };
    }
    throw error;
  }
}

interface PlannedLobbyRound extends PanoramaTarget {
  number: number;
  scene: RoundScene | null;
  weatherValidUntil: Date | null;
  weatherAttemptedIndices: number[];
  candidates: CandidateOption[] | null;
}

/**
 * Build all rounds for a fresh match using the lobby's retained settings.
 * R13: only Round 1 fetches weather at match start (once, max 3 locations);
 * Rounds 2..N plan their initial targets without spending weather budget until
 * `prepareFollowingRound` prepares each round during the preceding review.
 */
async function planLobbyRounds(
  lobby: MatchLobby,
  provider: PanoramaProvider,
  intelligence: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<PlannedLobbyRound[]> {
  const planned: PlannedLobbyRound[] = [];
  const used: number[] = [];
  const rules = gameRulesFor(lobby.difficulty);

  try {
    const first = await selectRoundWithWeather(used, provider, intelligence, {
      locate,
    });
    used.push(first.target.targetIndex);
    planned.push({
      ...first.target,
      number: 1,
      scene: first.scene,
      weatherValidUntil: first.weatherValidUntil,
      weatherAttemptedIndices: first.attemptedIndices,
      candidates:
        rules.selectionMode === 'list'
          ? buildCandidates(first.target.targetIndex, used)
          : null,
    });

    for (let number = 2; number <= lobby.roundsTotal; number += 1) {
      const target = await provider([...used]);
      used.push(target.targetIndex);
      planned.push({
        ...target,
        number,
        scene: null,
        weatherValidUntil: null,
        weatherAttemptedIndices: [],
        candidates:
          rules.selectionMode === 'list'
            ? buildCandidates(target.targetIndex, used)
            : null,
      });
    }
  } catch (error) {
    if (error instanceof PanoramaError) {
      throw new LobbyUnavailableError(error.reason, error.code);
    }
    throw error;
  }

  return planned;
}

/**
 * Atomically replace any previous rounds with the planned ones and flip the
 * lobby into `playing`. `expectedStatus` makes concurrent restarts safe: only
 * the first caller claims the transition.
 */
async function beginLobbyMatch(
  lobby: MatchLobby,
  planned: PlannedLobbyRound[],
  expectedStatus: 'waiting' | 'finished',
  db: PrismaClient,
): Promise<boolean> {
  const now = new Date();
  const rules = gameRulesFor(lobby.difficulty);
  let claimed = false;

  await db.$transaction(async (tx) => {
    const transition = await tx.lobby.updateMany({
      where: { id: lobby.id, status: expectedStatus },
      data: {
        status: 'playing',
        currentRound: 1,
        matchId: randomUUID(),
        startedAt: now,
        finishedAt: null,
        expiresAt: new Date(now.getTime() + LOBBY_TTL_MS),
      },
    });
    if (!transition.count) return;
    claimed = true;

    // A rematch replaces the previous match entirely, clearing the leaderboard.
    await tx.lobbyRound.deleteMany({ where: { lobbyId: lobby.id } });

    for (const round of planned) {
      await tx.lobbyRound.create({
        data: {
          lobbyId: lobby.id,
          number: round.number,
          panoId: round.panoId,
          targetIndex: round.targetIndex,
          targetLat: round.lat,
          targetLon: round.lon,
          placeName: placeNameForTarget(round),
          ...(round.scene
            ? { sceneJson: round.scene as unknown as Prisma.InputJsonValue }
            : {}),
          weatherValidUntil: round.weatherValidUntil,
          weatherAttemptedIndices: round.weatherAttemptedIndices,
          weatherExhausted: false,
          ...(round.candidates
            ? {
                candidatesJson:
                  round.candidates as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
      });
    }

    await tx.lobbyMember.updateMany({
      where: { lobbyId: lobby.id },
      data: {
        selectionLat: null,
        selectionLon: null,
        continueRequestedAt: null,
      },
    });

    const firstRound = await tx.lobbyRound.findUniqueOrThrow({
      where: { lobbyId_number: { lobbyId: lobby.id, number: 1 } },
      select: { id: true },
    });
    await tx.lobbyRound.update({
      where: { id: firstRound.id },
      data: {
        startedAt: now,
        endsAt: new Date(now.getTime() + rules.timeLimitSeconds * 1000),
      },
    });
  });

  return claimed;
}

/**
 * Remove members (and their match history) while preserving a valid host.
 * Serialized on the lobby row so a concurrent departure can never leave
 * `hostTokenHash` pointing at a removed member.
 */
async function removeLobbyMembers(
  lobby: MatchLobby,
  members: LobbyMember[],
  db: PrismaClient,
): Promise<void> {
  const removeIds = members.map((member) => member.id);
  if (removeIds.length === 0) return;

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Lobby" WHERE "id" = ${lobby.id} FOR UPDATE`;
    const liveLobby = await tx.lobby.findUnique({
      where: { id: lobby.id },
      select: { id: true, hostTokenHash: true },
    });
    if (!liveLobby) return;

    await tx.lobbyMember.deleteMany({
      where: { lobbyId: lobby.id, id: { in: removeIds } },
    });
    const remaining = await tx.lobbyMember.findMany({
      where: { lobbyId: lobby.id },
      orderBy: { joinedAt: 'asc' },
    });
    if (remaining.length === 0) {
      await tx.lobby.deleteMany({ where: { id: lobby.id } });
      return;
    }
    const hostStillPresent = remaining.some(
      (member) => member.playerTokenHash === liveLobby.hostTokenHash,
    );
    if (!hostStillPresent) {
      await tx.lobby.update({
        where: { id: lobby.id },
        data: { hostTokenHash: remaining[0]!.playerTokenHash },
      });
    }
  });
}

/**
 * Clear the finished match back to a waiting room. Used when only one player
 * continues (so there is not yet a match) or a rematch cannot be prepared.
 */
async function resetLobbyForNewGame(
  lobby: MatchLobby,
  db: PrismaClient,
  now: Date,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const transition = await tx.lobby.updateMany({
      where: { id: lobby.id, status: 'finished' },
      data: {
        status: 'waiting',
        currentRound: 0,
        startedAt: null,
        finishedAt: null,
        expiresAt: new Date(now.getTime() + LOBBY_TTL_MS),
      },
    });
    if (!transition.count) return;

    await tx.lobbyRound.deleteMany({ where: { lobbyId: lobby.id } });
    await tx.lobbyMember.updateMany({
      where: { lobbyId: lobby.id },
      data: {
        selectionLat: null,
        selectionLon: null,
        continueRequestedAt: null,
      },
    });
  });
}

function memberLabel(member: LobbyMember): string {
  return member.displayName?.trim() || 'Guest explorer';
}

/**
 * Rematch response deadline: null while nobody has requested a rematch so final
 * standings remain visible indefinitely (R16), and 30s after the first request.
 */
function continueWindowDeadline(lobby: MatchLobby): Date | null {
  let earliestMs: number | null = null;
  for (const member of lobby.members) {
    if (member.continueRequestedAt === null) continue;
    const ms = member.continueRequestedAt.getTime();
    if (earliestMs === null || ms < earliestMs) earliestMs = ms;
  }
  return earliestMs === null
    ? null
    : new Date(earliestMs + LOBBY_CONTINUE_WINDOW_MS);
}

/**
 * Resolve a finished lobby once at least one player opts into a rematch:
 * - while nobody has requested a rematch, keep the finished lobby intact so
 *   final standings remain visible on the match-complete screen (R16);
 * - once a rematch is requested, start it immediately when everyone is ready,
 *   or remove non-responders after the 30-second response window so continuing
 *   players are never blocked indefinitely.
 */
async function resolveFinishedLobby(
  lobby: MatchLobby,
  db: PrismaClient,
  now: Date,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<boolean> {
  if (lobby.status !== 'finished') return false;

  let mutated = false;
  if (lobby.finishedAt === null) {
    await db.lobby.update({
      where: { id: lobby.id },
      data: { finishedAt: now },
    });
    lobby.finishedAt = now;
    mutated = true;
  }

  const deadline = continueWindowDeadline(lobby);
  if (deadline === null) return mutated;

  const expired = now.getTime() >= deadline.getTime();
  if (!expired) {
    const allReady =
      lobby.members.length > 0 &&
      lobby.members.every((member) => member.continueRequestedAt !== null);
    if (!allReady) return mutated;
  }

  let current = lobby;
  if (expired) {
    const nonResponders = lobby.members.filter(
      (member) => member.continueRequestedAt === null,
    );
    if (nonResponders.length > 0) {
      await removeLobbyMembers(lobby, nonResponders, db);
      mutated = true;
      if (nonResponders.length === lobby.members.length) return true;
      try {
        current = await loadMatchLobby(lobby.code, db);
      } catch (error) {
        if (error instanceof LobbyNotFoundError) return true;
        throw error;
      }
      if (current.status !== 'finished') return true;
    }
  }

  if (current.members.length < 2 || !provider || !intelligence) {
    await resetLobbyForNewGame(current, db, now);
    return true;
  }

  let planned: PlannedLobbyRound[];
  try {
    planned = await planLobbyRounds(current, provider, intelligence, locate);
  } catch {
    // Do not trap players in a finished lobby if fresh rounds cannot load.
    await resetLobbyForNewGame(current, db, now);
    return true;
  }

  await beginLobbyMatch(current, planned, 'finished', db);
  return true;
}

function continuePromptView(
  lobby: MatchLobby,
  member: LobbyMember,
): LobbyMatchView['continuePrompt'] {
  if (lobby.status !== 'finished' || lobby.finishedAt === null) return null;
  const deadline = continueWindowDeadline(lobby);
  return {
    deadline: deadline?.toISOString() ?? null,
    readyPlayers: lobby.members
      .filter((candidate) => candidate.continueRequestedAt !== null)
      .map(memberLabel),
    pendingPlayers: lobby.members
      .filter((candidate) => candidate.continueRequestedAt === null)
      .map(memberLabel),
    youRequested: member.continueRequestedAt !== null,
  };
}

function buildMatchView(
  lobby: MatchLobby,
  member: LobbyMember,
): LobbyMatchView {
  const rules = gameRulesFor(lobby.difficulty);
  const currentRound =
    lobby.status === 'playing'
      ? (lobby.rounds.find(
          (candidate) => candidate.number === lobby.currentRound,
        ) ?? null)
      : null;
  const youResult =
    currentRound?.results.find((result) => result.memberId === member.id) ??
    null;
  const pendingPlayers = currentRound
    ? lobby.members
        .filter(
          (candidate) =>
            !currentRound.results.some(
              (result) => result.memberId === candidate.id,
            ),
        )
        .map((candidate) => candidate.displayName?.trim() || 'Guest explorer')
    : [];
  const viewerAttempts = currentRound
    ? [...currentRound.attempts]
        .filter((attempt) => attempt.memberId === member.id)
        .sort((a, b) => a.attemptNumber - b.attemptNumber)
    : [];
  const attemptsUsed = viewerAttempts.length;
  const currentCandidates = currentRound ? roundCandidates(currentRound) : null;
  const isList = rules.selectionMode === 'list';

  const revealedRounds = lobby.rounds.filter(
    (round) => round.number < lobby.currentRound || round.reviewEndsAt !== null || lobby.status === 'finished',
  );
  const yourResults = revealedRounds
    .map((round) => ({
      round,
      result: round.results.find(
        (candidate) => candidate.memberId === member.id,
      ),
    }))
    .filter(
      (
        entry,
      ): entry is { round: MatchRound; result: LobbyRoundResult } =>
        entry.result !== undefined,
    )
    .sort((a, b) => a.round.number - b.round.number)
    .map((entry) => resultView(lobby, entry.round, entry.result, member));

  const leaderboard = lobby.members
    .map((candidate) => {
      const results = revealedRounds
        .map((round) =>
          round.results.find((result) => result.memberId === candidate.id),
        )
        .filter((result): result is LobbyRoundResult => result !== undefined);
      return {
        memberId: candidate.id,
        displayName: candidate.displayName,
        isHost: candidate.playerTokenHash === lobby.hostTokenHash,
        isYou: candidate.id === member.id,
        totalScore: results.reduce((sum, result) => sum + result.score, 0),
        roundsCompleted: results.length,
      };
    })
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        b.roundsCompleted - a.roundsCompleted ||
        (a.displayName ?? '').localeCompare(b.displayName ?? ''),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    matchId: lobby.matchId,
    status: lobby.status,
    currentRound: currentRound?.number ?? null,
    roundsTotal: lobby.roundsTotal,
    difficulty: lobby.difficulty,
    rules,
    startedAt: lobby.startedAt?.toISOString() ?? null,
    // The caller's own deadline (hard-mode unlock shortens only their timer).
    endsAt: currentRound && !currentRound.reviewEndsAt
      ? (roundDeadline(currentRound, member)?.toISOString() ?? null)
      : null,
    round: currentRound ? publicRound(currentRound, rules, member) : null,
    roundComplete: Boolean(currentRound?.reviewEndsAt) || lobby.status === 'finished',
    reviewEndsAt: currentRound?.reviewEndsAt?.toISOString() ?? null,
    pendingPlayers,
    you: {
      attemptsUsed,
      attemptsTotal: rules.attemptsPerRound,
      selection:
        isList ||
        member.selectionLat === null ||
        member.selectionLon === null
          ? null
          : { lat: member.selectionLat, lon: member.selectionLon },
      selectedCandidateId:
        isList && currentRound
          ? (findCandidateByPoint(
              currentCandidates,
              member.selectionLat,
              member.selectionLon,
            )?.id ?? null)
          : null,
      submittedGuesses: isList
        ? []
        : viewerAttempts.map((attempt) => ({
            lat: attempt.guessLat,
            lon: attempt.guessLon,
          })),
      submittedCandidateIds: isList
        ? viewerAttempts.flatMap((attempt) => {
            const match = findCandidateByPoint(
              currentCandidates,
              attempt.guessLat,
              attempt.guessLon,
            );
            return match ? [match.id] : [];
          })
        : [],
      finalized: youResult !== null,
      result: yourResults.find((result) => result.roundNumber === currentRound?.number) ?? null,
    },
    leaderboard,
    results: yourResults,
    continuePrompt: continuePromptView(lobby, member),
  };
}

async function matchResponse(
  code: string,
  rawToken: string,
  db: PrismaClient,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
  preloaded?: MatchLobby,
): Promise<LobbyMatchResponse> {
  let current = preloaded ?? (await loadMatchLobby(code, db));
  let currentMember = memberForToken(current, rawToken);

  const progress = await ensureLobbyProgress(
    current,
    db,
    new Date(),
    provider,
    intelligence,
    locate,
  );
  if (progress.mutated) {
    const previousMatchId = current.matchId;
    const previousRound = current.currentRound;
    current = await loadMatchLobby(code, db);
    if (
      progress.unavailable &&
      current.matchId === previousMatchId &&
      current.currentRound === previousRound
    ) {
      throw progress.unavailable;
    }
    currentMember = memberForToken(current, rawToken);
  } else if (progress.unavailable) {
    throw progress.unavailable;
  }

  if (current.status === 'finished') {
    const resolved = await resolveFinishedLobby(
      current,
      db,
      new Date(),
      provider,
      intelligence,
      locate,
    );
    if (resolved) {
      current = await loadMatchLobby(code, db);
      currentMember = memberForToken(current, rawToken);
    }
  }

  return {
    lobby: toLobbyView(current, rawToken),
    match: buildMatchView(current, currentMember),
  };
}

export async function startLobbyMatch(
  code: string,
  rawToken: string,
  db: PrismaClient = prisma,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<LobbyMatchResponse> {
  const lobby = await loadMatchLobby(code, db);
  assertHost(lobby, memberForToken(lobby, rawToken));

  if (lobby.status === 'playing') {
    return matchResponse(code, rawToken, db, provider, intelligence, locate, lobby);
  }
  if (lobby.status !== 'waiting') {
    throw new LobbyConflictError('This lobby has already finished');
  }
  if (lobby.members.length < 2) {
    throw new LobbyConflictError(
      'At least two players are required to start a match',
    );
  }
  if (!provider || !intelligence) {
    throw new LobbyUnavailableError(
      'Street View is not configured on this server.',
    );
  }

  const planned = await planLobbyRounds(lobby, provider, intelligence, locate);
  await beginLobbyMatch(lobby, planned, 'waiting', db);

  return matchResponse(code, rawToken, db, provider, intelligence, locate);
}

export async function getLobbyMatch(
  code: string,
  rawToken: string,
  db: PrismaClient = prisma,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<LobbyMatchResponse> {
  return matchResponse(code, rawToken, db, provider, intelligence, locate);
}

/**
 * Record this player's choice to keep playing after a finished match. Once
 * every remaining player has chosen, a fresh match starts with the same lobby
 * settings and an empty leaderboard.
 */
export async function requestLobbyContinue(
  code: string,
  rawToken: string,
  db: PrismaClient = prisma,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<LobbyMatchResponse> {
  let lobby = await loadMatchLobby(code, db);
  let member = memberForToken(lobby, rawToken);

  const progress = await ensureLobbyProgress(
    lobby,
    db,
    new Date(),
    provider,
    intelligence,
    locate,
  );
  if (progress.mutated) {
    lobby = await loadMatchLobby(code, db);
    member = memberForToken(lobby, rawToken);
  }

  if (lobby.status === 'finished') {
    const resolvedBefore = await resolveFinishedLobby(
      lobby,
      db,
      new Date(),
      provider,
      intelligence,
      locate,
    );
    if (resolvedBefore) {
      lobby = await loadMatchLobby(code, db);
      member = memberForToken(lobby, rawToken);
    }
  }

  if (lobby.status === 'playing') {
    return matchResponse(code, rawToken, db, provider, intelligence, locate, lobby);
  }
  if (lobby.status !== 'finished') {
    throw new LobbyConflictError(
      'This lobby is not waiting for a continuation decision',
    );
  }

  if (member.continueRequestedAt === null) {
    await db.lobbyMember.update({
      where: { id: member.id },
      data: { continueRequestedAt: new Date() },
    });
    lobby = await loadMatchLobby(code, db);
  }

  return matchResponse(code, rawToken, db, provider, intelligence, locate, lobby);
}

export async function saveLobbySelection(
  code: string,
  rawToken: string,
  selection: GuessOrSelectionInput,
  db: PrismaClient = prisma,
  roundId?: string,
): Promise<void> {
  const lobby = await loadMatchLobby(code, db);
  const member = memberForToken(lobby, rawToken);
  if (lobby.status !== 'playing') {
    throw new LobbyConflictError('The match has not started');
  }
  const round = lobby.rounds.find(
    (candidate) => candidate.number === lobby.currentRound,
  );
  if (!round || (roundId !== undefined && round.id !== roundId) || isDeadlinePassed(roundDeadline(round, member), new Date())) {
    throw new LobbyConflictError('This round is no longer accepting guesses');
  }
  const completed = round.results.some(
    (result) => result.memberId === member.id,
  );
  if (completed) {
    throw new LobbyConflictError('Your guess for this round is already final');
  }
  const rules = gameRulesFor(lobby.difficulty);
  const point = resolveSelectionPoint(
    rules.selectionMode,
    selection,
    roundCandidates(round),
  );

  const updated = await db.lobbyMember.updateMany({
    where: {
      id: member.id,
      lobby: { matchId: lobby.matchId, currentRound: round.number, status: 'playing' },
      results: { none: { roundId: round.id } },
    },
    data: { selectionLat: point.lat, selectionLon: point.lon },
  });
  if (!updated.count) throw new LobbyConflictError('This round is no longer accepting guesses');
}

export async function unlockLobbyExtraData(
  code: string,
  roundNumber: number,
  rawToken: string,
  db: PrismaClient = prisma,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<LobbyMatchResponse> {
  const lobby = await loadMatchLobby(code, db);
  const member = memberForToken(lobby, rawToken);
  if (lobby.status !== 'playing') {
    throw new LobbyConflictError('The match is not in progress');
  }
  const round = lobby.rounds.find(
    (candidate) => candidate.number === roundNumber,
  );
  if (!round || round.number !== lobby.currentRound) {
    throw new LobbyConflictError('This round is not the active round');
  }
  const now = new Date();
  if (isDeadlinePassed(roundDeadline(round, member), now)) {
    await ensureLobbyProgress(lobby, db, now, provider, intelligence, locate);
    throw new LobbyConflictError('The time limit for this round has expired');
  }
  const completed = round.results.some(
    (result) => result.memberId === member.id,
  );
  if (completed) {
    throw new LobbyConflictError('Your guess for this round is already final');
  }

  const rules = gameRulesFor(lobby.difficulty);
  const state = memberState(round, member.id);
  // R05/R16: only this player unlocks and pays; free mode needs no state.
  if (rules.extraData.mode !== 'free' && state?.extraDataUnlockedAt == null) {
    const deadline =
      roundDeadline(round, member) ??
      new Date(now.getTime() + rules.timeLimitSeconds * 1000);
    const data =
      rules.extraData.mode === 'points'
        ? {
            extraDataUnlockedAt: now,
            extraDataPointsSpent: rules.extraData.cost,
          }
        : {
            extraDataUnlockedAt: now,
            endsAt: applyTimePenalty(deadline, rules.extraData.cost, now),
          };
    try {
      await db.lobbyRoundMemberState.create({
        data: { roundId: round.id, memberId: member.id, ...data },
      });
    } catch (error) {
      // A concurrent unlock already created the row; first unlock wins.
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  return matchResponse(code, rawToken, db, provider, intelligence, locate);
}

export async function submitLobbyGuess(
  code: string,
  roundNumber: number,
  rawToken: string,
  body: LobbyGuessBody,
  db: PrismaClient = prisma,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<LobbyGuessResponse> {
  const lobby = await loadMatchLobby(code, db);
  const member = memberForToken(lobby, rawToken);
  if (lobby.status !== 'playing') {
    throw new LobbyConflictError('The match is not in progress');
  }
  const round = lobby.rounds.find(
    (candidate) => candidate.number === roundNumber,
  );
  if (!round || round.number !== lobby.currentRound) {
    throw new LobbyConflictError('This round is not the active round');
  }
  const rules = gameRulesFor(lobby.difficulty);
  const attempts = round.attempts.filter(
    (attempt) => attempt.memberId === member.id,
  );
  const decision = decideAttempt({
    attemptsUsed: attempts.length,
    attemptsTotal: rules.attemptsPerRound,
    requestedFinal: body.final === true,
    finalized: round.results.some((result) => result.memberId === member.id),
    deadlinePassed: isDeadlinePassed(roundDeadline(round, member), new Date()),
  });
  if (!decision.allowed) {
    if (decision.reason === 'deadline') {
      await ensureLobbyProgress(lobby, db, new Date(), provider, intelligence, locate);
      throw new LobbyConflictError('The time limit for this round has expired');
    }
    if (decision.reason === 'exhausted') {
      throw new LobbyConflictError('No attempts remain for this round');
    }
    throw new LobbyConflictError('Your guess for this round is already final');
  }

  const point = resolveSelectionPoint(
    rules.selectionMode,
    body,
    roundCandidates(round),
  );
  const actual = await roundPoint(round, locate);
  const { distanceKm, score } = evaluateGuess(point, actual);

  type GuessOutcome =
    | { expired: true }
    | {
        expired: false;
        finalized: boolean;
        attemptsRemaining: number;
        attemptsUsed: number;
      };

  const outcome: GuessOutcome = await db.$transaction(async (tx) => {
    // Lock this member's row to serialize concurrent guesses, hard-mode
    // unlocks, and finalization within the same round.
    await tx.$queryRaw`SELECT "id" FROM "LobbyMember" WHERE "id" = ${member.id} FOR UPDATE`;
    const liveMember = await tx.lobbyMember.findUnique({
      where: { id: member.id },
      select: { id: true },
    });
    if (!liveMember) throw new LobbyNotFoundError();

    const liveRound = await tx.lobbyRound.findUnique({
      where: { id: round.id },
      include: {
        attempts: { where: { memberId: member.id } },
        results: { where: { memberId: member.id } },
        memberStates: { where: { memberId: member.id } },
      },
    });
    if (!liveRound) {
      throw new LobbyConflictError('This round is not the active round');
    }

    const liveDecision = decideAttempt({
      attemptsUsed: liveRound.attempts.length,
      attemptsTotal: rules.attemptsPerRound,
      requestedFinal: body.final === true,
      finalized: liveRound.results.length > 0,
      deadlinePassed: isDeadlinePassed(roundDeadline(liveRound, member), new Date()),
    });
    if (!liveDecision.allowed) {
      if (liveDecision.reason === 'deadline') return { expired: true };
      if (liveDecision.reason === 'exhausted') {
        throw new LobbyConflictError('No attempts remain for this round');
      }
      throw new LobbyConflictError('Your guess for this round is already final');
    }

    let created: LobbyRoundAttempt;
    try {
      created = await tx.lobbyRoundAttempt.create({
        data: {
          roundId: round.id,
          memberId: member.id,
          attemptNumber: liveDecision.attemptNumber,
          guessLat: point.lat,
          guessLon: point.lon,
          distanceKm,
          score,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new LobbyConflictError(
          'Another guess was submitted at the same time; retry the action',
        );
      }
      throw error;
    }

    await tx.lobbyMember.update({
      where: { id: member.id },
      data: { selectionLat: point.lat, selectionLon: point.lon },
    });

    if (!liveDecision.finalizes) {
      return {
        expired: false,
        finalized: false,
        attemptsRemaining: liveDecision.attemptsRemaining,
        attemptsUsed: liveDecision.attemptNumber,
      };
    }

    const allAttempts = [...liveRound.attempts, created];
    const extraDataPointsSpent = liveRound.memberStates[0]?.extraDataPointsSpent ?? 0;
    const evaluated = computeScore({
      attempts: allAttempts,
      selection: point,
      actual,
      pointsSpent: extraDataPointsSpent,
    });
    const finalizedResult = await tx.lobbyRoundResult.upsert({
      where: {
        roundId_memberId: { roundId: round.id, memberId: member.id },
      },
      create: {
        roundId: round.id,
        memberId: member.id,
        actualLat: actual.lat,
        actualLon: actual.lon,
        guessLat: evaluated.guess?.lat ?? null,
        guessLon: evaluated.guess?.lon ?? null,
        distanceKm: evaluated.distanceKm,
        score: evaluated.score,
        attemptsUsed: allAttempts.length,
        extraDataPointsSpent,
      },
      update: {},
    });

    return {
      expired: false,
      finalized: true,
      attemptsRemaining: 0,
      attemptsUsed: finalizedResult.attemptsUsed,
    };
  });

  if (outcome.expired) {
    await ensureLobbyProgress(lobby, db, new Date(), provider, intelligence, locate);
    throw new LobbyConflictError('The time limit for this round has expired');
  }

  if (outcome.finalized) {
    const afterGuess = await loadMatchLobby(code, db);
    await ensureLobbyProgress(afterGuess, db, new Date(), provider, intelligence, locate);
  }

  return {
    finalized: outcome.finalized,
    attemptsRemaining: outcome.attemptsRemaining,
    attemptsUsed: outcome.attemptsUsed,
  };
}

export async function finishLobbyRound(
  code: string,
  roundNumber: number,
  rawToken: string,
  db: PrismaClient = prisma,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<LobbyGuessResponse> {
  const lobby = await loadMatchLobby(code, db);
  const member = memberForToken(lobby, rawToken);
  if (lobby.status !== 'playing') {
    throw new LobbyConflictError('The match is not in progress');
  }
  const round = lobby.rounds.find(
    (candidate) => candidate.number === roundNumber,
  );
  if (!round || round.number !== lobby.currentRound) {
    throw new LobbyConflictError('This round is not the active round');
  }
  if (isDeadlinePassed(roundDeadline(round, member), new Date())) {
    await ensureLobbyProgress(lobby, db, new Date(), provider, intelligence, locate);
    throw new LobbyConflictError('The time limit for this round has expired');
  }
  const alreadyFinal = round.results.some(
    (result) => result.memberId === member.id,
  );
  if (alreadyFinal) {
    throw new LobbyConflictError('Your guess for this round is already final');
  }
  const attempts = round.attempts.filter(
    (attempt) => attempt.memberId === member.id,
  );
  if (attempts.length === 0) {
    throw new LobbyConflictError(
      'Submit at least one guess before finishing the round',
    );
  }

  const result = await finalizeMemberRound(
    db,
    round,
    member,
    attempts,
    await roundPoint(round, locate),
  );
  const afterFinish = await loadMatchLobby(code, db);
  await ensureLobbyProgress(afterFinish, db, new Date(), provider, intelligence, locate);
  return {
    finalized: true,
    attemptsRemaining: 0,
    attemptsUsed: result.attemptsUsed,
  };
}

export async function getLobbyRoundIntelligence(
  code: string,
  roundNumber: number,
  rawToken: string,
  db: PrismaClient = prisma,
  intelligence?: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<GeographicIntelligence> {
  const lobby = await loadMatchLobby(code, db);
  const member = memberForToken(lobby, rawToken);
  if (lobby.status !== 'playing' || lobby.currentRound !== roundNumber) {
    throw new LobbyConflictError(
      'Environmental clues are only available for the active round.',
    );
  }
  const round = lobby.rounds.find(
    (candidate) => candidate.number === roundNumber,
  );
  if (!round) {
    throw new LobbyNotFoundError();
  }
  if (!intelligence) {
    throw new LobbyUnavailableError(
      'Environmental data is not configured on this server.',
    );
  }
  const point = await roundPoint(round, locate);
  const rules = gameRulesFor(lobby.difficulty);
  const state = memberState(round, member.id);
  const { unlocked } = extraDataAccess(
    {
      unlockedAt: state?.extraDataUnlockedAt ?? null,
      pointsSpent: state?.extraDataPointsSpent ?? 0,
    },
    rules,
  );
  const data = unlocked
    ? await intelligence(point.lat, point.lon)
    : await intelligence(point.lat, point.lon, { includeEnvironment: false });
  return redactLockedExtraData(
    withCurrentRoundWeather(data),
    unlocked,
  );
}
