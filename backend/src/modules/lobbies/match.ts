import { Prisma } from '@prisma/client';
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
  LOBBY_TTL_MS,
} from '../../config/constants.js';
import { haversineKm } from '../../domain/distance.js';
import { gameRulesFor } from '../../domain/gameRules.js';
import type { GameRules } from '../../domain/gameRules.js';
import {
  applyPointPenalty,
  applyTimePenalty,
  isDeadlinePassed,
} from '../../domain/roundFlow.js';
import { scoreForDistance } from '../../domain/scoring.js';
import { hashPlayerToken } from '../../plugins/auth.js';
import type {
  LobbyGuessBody,
  LobbyGuessResponse,
  LobbyMatchResponse,
  LobbyMatchView,
} from '../../contracts/lobbies.js';
import type { GeographicIntelligence } from '../intelligence/contract.js';
import { buildCandidates } from '../singleplayer/candidates.js';
import type { CandidateOption } from '../singleplayer/candidates.js';
import {
  selectValidatedTarget,
  type IntelligenceLookup,
} from '../singleplayer/locationSelection.js';
import type { PanoramaProvider } from '../singleplayer/provider.js';
import { PanoramaError } from '../singleplayer/providerErrors.js';
import {
  LobbyConflictError,
  LobbyForbiddenError,
  LobbyNotFoundError,
  toLobbyView,
} from './service.js';

export class LobbyUnavailableError extends Error {
  public readonly statusCode = 503;

  public constructor(message: string) {
    super(message);
    this.name = 'LobbyUnavailableError';
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

function extraDataAccess(
  round: MatchRound,
  member: LobbyMember,
  rules: GameRules,
) {
  const state = memberState(round, member.id);
  const unlocked =
    rules.extraData.mode === 'free' || state?.extraDataUnlockedAt != null;
  return {
    mode:
      rules.extraData.mode === 'free'
        ? ('immediate' as const)
        : rules.extraData.mode,
    cost: rules.extraData.mode === 'free' ? null : rules.extraData.cost,
    availableAt: null,
    unlocked,
    pointsSpent: state?.extraDataPointsSpent ?? 0,
  };
}

function publicRound(round: MatchRound, rules: GameRules, member: LobbyMember) {
  const candidates = roundCandidates(round);
  return {
    id: round.id,
    number: round.number,
    panoId: round.panoId,
    ...(candidates && candidates.length ? { candidates } : {}),
    endsAt: round.endsAt?.toISOString() ?? null,
    attemptsUsed: round.attempts.filter(
      (attempt) => attempt.memberId === member.id,
    ).length,
    attemptsTotal: rules.attemptsPerRound,
    extraData: extraDataAccess(round, member, rules),
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
 * Guesses are only attached to a result the caller is allowed to read: their
 * own finalized result, or a completed historical round. Pending players never
 * receive someone else's marker for the active round.
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

function resultView(
  lobby: MatchLobby,
  round: MatchRound,
  result: LobbyRoundResult,
  viewer: LobbyMember,
) {
  return {
    roundNumber: round.number,
    score: result.score,
    distanceKm: result.distanceKm,
    guess:
      result.guessLat === null || result.guessLon === null
        ? null
        : { lat: result.guessLat, lon: result.guessLon },
    actual: { lat: round.targetLat, lon: round.targetLon },
    attemptsUsed: result.attemptsUsed,
    extraDataPointsSpent: result.extraDataPointsSpent,
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

function bestAttempt(attempts: LobbyRoundAttempt[]): LobbyRoundAttempt | null {
  return (
    [...attempts].sort(
      (a, b) =>
        b.score - a.score ||
        a.distanceKm - b.distanceKm ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    )[0] ?? null
  );
}

async function finalizeMemberRound(
  db: PrismaClient,
  round: MatchRound,
  member: LobbyMember,
  attempts: LobbyRoundAttempt[],
): Promise<LobbyRoundResult> {
  const best = bestAttempt(attempts);
  const guess =
    best !== null
      ? { lat: best.guessLat, lon: best.guessLon }
      : member.selectionLat !== null && member.selectionLon !== null
        ? { lat: member.selectionLat, lon: member.selectionLon }
        : null;
  const actual = { lat: round.targetLat, lon: round.targetLon };
  const distanceKm = guess === null ? null : haversineKm(guess, actual);
  const rawScore = distanceKm === null ? 0 : scoreForDistance(distanceKm);
  // Read the latest per-player state so a concurrent unlock is still charged.
  const state = await db.lobbyRoundMemberState.findUnique({
    where: {
      roundId_memberId: { roundId: round.id, memberId: member.id },
    },
  });
  const extraDataPointsSpent = state?.extraDataPointsSpent ?? 0;
  const score = applyPointPenalty(rawScore, extraDataPointsSpent);

  return db.lobbyRoundResult.upsert({
    where: {
      roundId_memberId: { roundId: round.id, memberId: member.id },
    },
    create: {
      roundId: round.id,
      memberId: member.id,
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

async function ensureLobbyProgress(
  lobby: MatchLobby,
  db: PrismaClient,
  now: Date,
): Promise<void> {
  if (lobby.status !== 'playing') return;

  const round = lobby.rounds.find(
    (candidate) => candidate.number === lobby.currentRound,
  );
  if (!round) return;

  const completed = new Set(round.results.map((result) => result.memberId));
  // Each player has their own deadline (a hard-mode unlock shortens only the
  // unlocking player's timer), so finalize anyone whose own time ran out even
  // if the round itself stays open for the others.
  const stillPlaying = lobby.members.filter(
    (member) =>
      !completed.has(member.id) &&
      !isDeadlinePassed(roundDeadline(round, member), now),
  );
  for (const member of lobby.members) {
    if (completed.has(member.id)) continue;
    if (!isDeadlinePassed(roundDeadline(round, member), now)) continue;
    await finalizeMemberRound(
      db,
      round,
      member,
      round.attempts.filter((attempt) => attempt.memberId === member.id),
    );
  }
  if (stillPlaying.length > 0) return;

  const nextRound = lobby.rounds.find(
    (candidate) => candidate.number === round.number + 1,
  );
  const data = nextRound
    ? { currentRound: nextRound.number, startedAt: now, finishedAt: null }
    : { status: 'finished' as const, finishedAt: now };

  const claimed = await db.lobby.updateMany({
    where: {
      id: lobby.id,
      status: 'playing',
      currentRound: round.number,
    },
    data,
  });
  if (!claimed.count || !nextRound) return;

  const rules = gameRulesFor(lobby.difficulty);
  await db.lobbyRound.update({
    where: { id: nextRound.id },
    data: {
      startedAt: now,
      endsAt: new Date(now.getTime() + rules.timeLimitSeconds * 1000),
    },
  });
  await db.lobbyMember.updateMany({
    where: { lobbyId: lobby.id },
    data: { selectionLat: null, selectionLon: null },
  });
}

interface PlannedLobbyRound {
  number: number;
  panoId: string;
  targetIndex: number;
  targetLat: number;
  targetLon: number;
  candidates: CandidateOption[] | null;
}

/** Build all rounds for a fresh match using the lobby's retained settings. */
async function planLobbyRounds(
  lobby: MatchLobby,
  provider: PanoramaProvider,
  intelligence: IntelligenceLookup,
): Promise<PlannedLobbyRound[]> {
  const planned: PlannedLobbyRound[] = [];
  const used: number[] = [];

  try {
    for (let number = 1; number <= lobby.roundsTotal; number += 1) {
      const target = await selectValidatedTarget(used, provider, intelligence);
      used.push(target.targetIndex);
      planned.push({
        number,
        panoId: target.panoId,
        targetIndex: target.targetIndex,
        targetLat: target.lat,
        targetLon: target.lon,
        candidates:
          lobby.difficulty === 'easy'
            ? buildCandidates(target.targetIndex, used)
            : null,
      });
    }
  } catch (error) {
    if (error instanceof PanoramaError) {
      throw new LobbyUnavailableError(error.reason);
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
          targetLat: round.targetLat,
          targetLon: round.targetLon,
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

/** Remove members (and their match history) while preserving a valid host. */
async function removeLobbyMembers(
  lobby: MatchLobby,
  members: LobbyMember[],
  db: PrismaClient,
): Promise<void> {
  const removeIds = new Set(members.map((member) => member.id));
  const remaining = lobby.members.filter((member) => !removeIds.has(member.id));

  if (remaining.length === 0) {
    await db.lobby.delete({ where: { id: lobby.id } });
    return;
  }

  const hostRemoved = remaining.every(
    (member) => member.playerTokenHash !== lobby.hostTokenHash,
  );
  const nextHost = hostRemoved ? remaining[0]! : null;

  await db.$transaction(async (tx) => {
    await tx.lobbyMember.deleteMany({
      where: { lobbyId: lobby.id, id: { in: [...removeIds] } },
    });
    if (nextHost) {
      await tx.lobby.update({
        where: { id: lobby.id },
        data: { hostTokenHash: nextHost.playerTokenHash },
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
 * Resolve a finished lobby's 30-second decision window:
 * - remove players who did not answer by the deadline,
 * - start a rematch once everyone has chosen to continue (or the deadline has
 *   passed), or return a lone continuing player to the waiting room.
 */
async function resolveFinishedLobby(
  lobby: MatchLobby,
  db: PrismaClient,
  now: Date,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
): Promise<void> {
  if (lobby.status !== 'finished') return;

  if (lobby.finishedAt === null) {
    await db.lobby.update({
      where: { id: lobby.id },
      data: { finishedAt: now },
    });
    lobby.finishedAt = now;
  }

  const deadline = new Date(
    lobby.finishedAt.getTime() + LOBBY_CONTINUE_WINDOW_MS,
  );
  const expired = now.getTime() >= deadline.getTime();

  if (expired) {
    const nonResponders = lobby.members.filter(
      (member) => member.continueRequestedAt === null,
    );
    if (nonResponders.length > 0) {
      await removeLobbyMembers(lobby, nonResponders, db);
      if (nonResponders.length === lobby.members.length) return;
    }
  }

  let current: MatchLobby;
  try {
    current = await loadMatchLobby(lobby.code, db);
  } catch (error) {
    if (error instanceof LobbyNotFoundError) return;
    throw error;
  }
  if (current.status !== 'finished') return;

  const allReady =
    current.members.length > 0 &&
    current.members.every((member) => member.continueRequestedAt !== null);
  if (!expired && !allReady) return;

  if (current.members.length < 2 || !provider || !intelligence) {
    await resetLobbyForNewGame(current, db, now);
    return;
  }

  let planned: PlannedLobbyRound[];
  try {
    planned = await planLobbyRounds(current, provider, intelligence);
  } catch {
    // Do not trap players in a finished lobby if fresh rounds cannot load.
    await resetLobbyForNewGame(current, db, now);
    return;
  }

  await beginLobbyMatch(current, planned, 'finished', db);
}

function continuePromptView(
  lobby: MatchLobby,
  member: LobbyMember,
): LobbyMatchView['continuePrompt'] {
  if (lobby.status !== 'finished' || lobby.finishedAt === null) return null;
  const deadline = new Date(
    lobby.finishedAt.getTime() + LOBBY_CONTINUE_WINDOW_MS,
  );
  return {
    deadline: deadline.toISOString(),
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
  const attemptsUsed =
    currentRound?.attempts.filter((attempt) => attempt.memberId === member.id)
      .length ?? 0;

  const yourResults = lobby.rounds
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
      const results = lobby.rounds
        .map((round) =>
          round.results.find((result) => result.memberId === candidate.id),
        )
        .filter((result): result is LobbyRoundResult => result !== undefined);
      return {
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
    status: lobby.status,
    currentRound: currentRound?.number ?? null,
    roundsTotal: lobby.roundsTotal,
    difficulty: lobby.difficulty,
    rules,
    startedAt: lobby.startedAt?.toISOString() ?? null,
    // The caller's own deadline (hard-mode unlock shortens only their timer).
    endsAt: currentRound
      ? (roundDeadline(currentRound, member)?.toISOString() ?? null)
      : null,
    round: currentRound ? publicRound(currentRound, rules, member) : null,
    roundComplete:
      currentRound !== null
        ? pendingPlayers.length === 0
        : lobby.status === 'finished',
    pendingPlayers,
    you: {
      attemptsUsed,
      attemptsTotal: rules.attemptsPerRound,
      selection:
        member.selectionLat === null || member.selectionLon === null
          ? null
          : { lat: member.selectionLat, lon: member.selectionLon },
      finalized: youResult !== null,
      result:
        youResult && currentRound
          ? resultView(lobby, currentRound, youResult, member)
          : null,
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
): Promise<LobbyMatchResponse> {
  const lobby = await loadMatchLobby(code, db);
  memberForToken(lobby, rawToken);
  await ensureLobbyProgress(lobby, db, new Date());

  let refreshed = await loadMatchLobby(code, db);
  if (refreshed.status === 'finished') {
    await resolveFinishedLobby(
      refreshed,
      db,
      new Date(),
      provider,
      intelligence,
    );
    refreshed = await loadMatchLobby(code, db);
  }

  const refreshedMember = memberForToken(refreshed, rawToken);
  return {
    lobby: toLobbyView(refreshed, rawToken),
    match: buildMatchView(refreshed, refreshedMember),
  };
}

export async function startLobbyMatch(
  code: string,
  rawToken: string,
  db: PrismaClient = prisma,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
): Promise<LobbyMatchResponse> {
  const lobby = await loadMatchLobby(code, db);
  assertHost(lobby, memberForToken(lobby, rawToken));

  if (lobby.status === 'playing') {
    return matchResponse(code, rawToken, db, provider, intelligence);
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

  const planned = await planLobbyRounds(lobby, provider, intelligence);
  await beginLobbyMatch(lobby, planned, 'waiting', db);

  return matchResponse(code, rawToken, db, provider, intelligence);
}

export async function getLobbyMatch(
  code: string,
  rawToken: string,
  db: PrismaClient = prisma,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
): Promise<LobbyMatchResponse> {
  return matchResponse(code, rawToken, db, provider, intelligence);
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
): Promise<LobbyMatchResponse> {
  let lobby = await loadMatchLobby(code, db);
  memberForToken(lobby, rawToken);
  await ensureLobbyProgress(lobby, db, new Date());

  lobby = await loadMatchLobby(code, db);
  await resolveFinishedLobby(lobby, db, new Date(), provider, intelligence);
  lobby = await loadMatchLobby(code, db);
  const member = memberForToken(lobby, rawToken);

  if (lobby.status === 'playing') {
    return matchResponse(code, rawToken, db, provider, intelligence);
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
  }

  const refreshed = await loadMatchLobby(code, db);
  await resolveFinishedLobby(
    refreshed,
    db,
    new Date(),
    provider,
    intelligence,
  );

  return matchResponse(code, rawToken, db, provider, intelligence);
}

export async function saveLobbySelection(
  code: string,
  rawToken: string,
  selection: { lat: number; lon: number },
  db: PrismaClient = prisma,
): Promise<void> {
  const lobby = await loadMatchLobby(code, db);
  const member = memberForToken(lobby, rawToken);
  if (lobby.status !== 'playing') {
    throw new LobbyConflictError('The match has not started');
  }
  const round = lobby.rounds.find(
    (candidate) => candidate.number === lobby.currentRound,
  );
  if (!round || isDeadlinePassed(roundDeadline(round, member), new Date())) {
    throw new LobbyConflictError('This round is no longer accepting guesses');
  }
  const completed = round.results.some(
    (result) => result.memberId === member.id,
  );
  if (completed) {
    throw new LobbyConflictError('Your guess for this round is already final');
  }

  await db.lobbyMember.update({
    where: { id: member.id },
    data: { selectionLat: selection.lat, selectionLon: selection.lon },
  });
}

export async function unlockLobbyExtraData(
  code: string,
  roundNumber: number,
  rawToken: string,
  db: PrismaClient = prisma,
  provider?: PanoramaProvider,
  intelligence?: IntelligenceLookup,
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
    await ensureLobbyProgress(lobby, db, now);
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
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
    }
  }

  const refreshed = await loadMatchLobby(code, db);
  await ensureLobbyProgress(refreshed, db, now);
  return matchResponse(code, rawToken, db, provider, intelligence);
}

export async function submitLobbyGuess(
  code: string,
  roundNumber: number,
  rawToken: string,
  body: LobbyGuessBody,
  db: PrismaClient = prisma,
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
    await ensureLobbyProgress(lobby, db, new Date());
    throw new LobbyConflictError('The time limit for this round has expired');
  }
  const alreadyFinal = round.results.some(
    (result) => result.memberId === member.id,
  );
  if (alreadyFinal) {
    throw new LobbyConflictError('Your guess for this round is already final');
  }

  const rules = gameRulesFor(lobby.difficulty);
  const attempts = round.attempts.filter(
    (attempt) => attempt.memberId === member.id,
  );
  if (attempts.length >= rules.attemptsPerRound) {
    throw new LobbyConflictError('No attempts remain for this round');
  }

  const actual = { lat: round.targetLat, lon: round.targetLon };
  const distanceKm = haversineKm(body, actual);
  const score = scoreForDistance(distanceKm);
  const attemptNumber = attempts.length + 1;

  let created: LobbyRoundAttempt;
  try {
    created = await db.lobbyRoundAttempt.create({
      data: {
        roundId: round.id,
        memberId: member.id,
        attemptNumber,
        guessLat: body.lat,
        guessLon: body.lon,
        distanceKm,
        score,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new LobbyConflictError(
        'Another guess was submitted at the same time; retry the action',
      );
    }
    throw error;
  }

  await db.lobbyMember.update({
    where: { id: member.id },
    data: { selectionLat: body.lat, selectionLon: body.lon },
  });

  const finalized =
    body.final === true || attemptNumber >= rules.attemptsPerRound;
  if (!finalized) {
    return {
      finalized: false,
      attemptsRemaining: rules.attemptsPerRound - attemptNumber,
    };
  }

  const result = await finalizeMemberRound(db, round, member, [
    ...attempts,
    created,
  ]);
  const afterGuess = await loadMatchLobby(code, db);
  await ensureLobbyProgress(afterGuess, db, new Date());

  return {
    finalized: true,
    attemptsRemaining: 0,
    result: resultView(
      lobby,
      { ...round, results: [...round.results, result] },
      result,
      member,
    ),
  };
}

export async function finishLobbyRound(
  code: string,
  roundNumber: number,
  rawToken: string,
  db: PrismaClient = prisma,
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
    await ensureLobbyProgress(lobby, db, new Date());
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

  const result = await finalizeMemberRound(db, round, member, attempts);
  const afterFinish = await loadMatchLobby(code, db);
  await ensureLobbyProgress(afterFinish, db, new Date());
  return {
    finalized: true,
    attemptsRemaining: 0,
    result: resultView(
      lobby,
      { ...round, results: [...round.results, result] },
      result,
      member,
    ),
  };
}

export async function getLobbyRoundIntelligence(
  code: string,
  roundNumber: number,
  rawToken: string,
  db: PrismaClient = prisma,
  intelligence?: IntelligenceLookup,
): Promise<GeographicIntelligence> {
  const lobby = await loadMatchLobby(code, db);
  memberForToken(lobby, rawToken);
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
  return intelligence(round.targetLat, round.targetLon);
}
