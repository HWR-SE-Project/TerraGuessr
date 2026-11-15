/**
 * Async challenges service (B-10, R16/ADR-0005).
 *
 * A challenge pins one finished round (roundId @unique) so many players can
 * attach their results and compare on a public leaderboard. No WebSockets, no
 * live presence — just an immutable share link plus ranked entries (B.3/B.6).
 */

import type { PrismaClient } from '@prisma/client';

import { GameNotFoundError, generatePlayerToken, hashPlayerToken } from '../../plugins/auth.js';
import { buildCandidates, resolveSelectionMode } from '../../domain/selection.js';
import type { PoolItem, SelectionMode } from '../../domain/selection.js';
import { LocationsService } from '../locations/service.js';
import { resolveCandidateNames } from '../rounds/service.js';
import { toRoundView } from '../rounds/dto.js';
import type {
  CreateChallengeResponse,
  CreateEntryResponse,
  JoinChallengeResponse,
  LeaderboardResponse,
} from '../../contracts/challenges.js';

/** 409 CONFLICT for a result outside the challenge round or a duplicate entry. */
export class ChallengeConflictError extends Error {
  public readonly statusCode = 409;

  public constructor(message: string) {
    super(message);
    this.name = 'ChallengeConflictError';
  }
}

interface Rankable {
  score: number;
  distanceKm: number;
}

/** Leaderboard ordering: score desc, then distance asc (R16). */
function compareLeaderboard(a: Rankable, b: Rankable): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  return a.distanceKm - b.distanceKm;
}

/** Competition rank (ties share a rank): 1 + count of strictly-better entries. */
function rankFor<T extends Rankable>(entries: readonly T[], target: T): number {
  let rank = 1;
  for (const entry of entries) {
    if (entry === target) {
      continue;
    }
    if (compareLeaderboard(entry, target) < 0) {
      rank += 1;
    }
  }
  return rank;
}

/** Blank/absent display names are stored as null (rendered 'Anonymous' client-side, B.6). */
function normalizeDisplayName(name: string | undefined): string | null {
  if (name === undefined) {
    return null;
  }
  const trimmed = name.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Create a challenge for an existing round and return its share link. The
 * shareUrl is a relative path (no real domain) — the frontend composes the
 * final URL at render time.
 */
export async function createChallenge(
  roundId: string,
  db: PrismaClient,
): Promise<CreateChallengeResponse> {
  const round = await db.round.findUnique({ where: { id: roundId } });
  if (!round) {
    throw new GameNotFoundError();
  }

  const challenge = await db.challenge.create({ data: { roundId } });

  return {
    challengeId: challenge.id,
    shareUrl: '/challenge/' + challenge.id,
  };
}

/**
 * Join a challenge as an independent participant (P0-3). Issues a fresh
 * player token and game (mode 'challenge'), and a Round pinned to the exact
 * same locationId/weatherSnapshotId as the challenge's original round — so
 * every participant faces the identical location and weather, never a
 * re-rolled one. Ownership of this new round belongs solely to the new
 * token; it never touches the original creator's game or round.
 */
export async function joinChallenge(
  challengeId: string,
  input: { selectionMode?: SelectionMode },
  db: PrismaClient,
): Promise<JoinChallengeResponse> {
  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: {
      round: {
        select: {
          difficulty: true,
          locationId: true,
          weatherSnapshotId: true,
          location: { select: { lat: true, lon: true, region: true } },
          weatherSnapshot: {
            select: {
              temperatureC: true,
              precipitationMm: true,
              humidityPct: true,
              windSpeedKmh: true,
              airPressureHpa: true,
              windDirectionDeg: true,
              uvIndex: true,
              sunshineDurationSeconds: true,
              localTime: true,
            },
          },
        },
      },
    },
  });
  if (!challenge) {
    throw new GameNotFoundError();
  }

  const { difficulty } = challenge.round;
  const playerToken = generatePlayerToken();
  const playerTokenHash = hashPlayerToken(playerToken);

  const game = await db.game.create({
    data: { mode: 'challenge', difficulty, playerTokenHash },
  });

  const selectionMode = resolveSelectionMode(difficulty, input.selectionMode);
  const actual: PoolItem = {
    id: challenge.round.locationId,
    lat: challenge.round.location.lat,
    lon: challenge.round.location.lon,
    region: challenge.round.location.region,
  };

  let candidates: readonly PoolItem[] = [];
  if (selectionMode === 'list') {
    const pool = await new LocationsService(db).listPool();
    candidates = buildCandidates(difficulty, pool, new Set(), actual, Math.random);
  }

  const round = await db.round.create({
    data: {
      gameId: game.id,
      locationId: challenge.round.locationId,
      weatherSnapshotId: challenge.round.weatherSnapshotId,
      roundNumber: 1,
      difficulty,
      selectionMode,
      status: 'active',
    },
  });

  const candidateViews =
    selectionMode === 'list' ? await resolveCandidateNames(candidates, db) : undefined;

  const view = toRoundView({
    round: { roundId: round.id, roundNumber: 1, attemptsTotal: 1, difficulty, selectionMode, additionalData: { mode: 'immediate', cost: null, availableAt: null, unlocked: true } },
    weather: challenge.round.weatherSnapshot,
    candidates: candidateViews,
  });

  return { gameId: game.id, playerToken, round: view };
}

/**
 * Attach a completed result to a challenge leaderboard. The result must be
 * for the challenge's pinned location (409 otherwise — not a literal roundId
 * match, since every participant plays their own round, see joinChallenge
 * above) and a player may enter at most once per challenge, whether by
 * resubmitting the same result or joining again under the same token (409 on
 * either). Ownership of the result is enforced upstream.
 */
export async function addEntry(
  challengeId: string,
  input: { resultId: string; displayName?: string },
  db: PrismaClient,
  rawPlayerToken: string,
): Promise<CreateEntryResponse> {
  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: { round: { select: { locationId: true } } },
  });
  if (!challenge) {
    throw new GameNotFoundError();
  }

  const result = await db.result.findUnique({
    where: { id: input.resultId },
    include: { round: { select: { locationId: true } } },
  });
  if (!result) {
    throw new GameNotFoundError();
  }

  if (result.round.locationId !== challenge.round.locationId) {
    throw new ChallengeConflictError('Result is not for this challenge location');
  }

  const playerTokenHash = hashPlayerToken(rawPlayerToken);

  const existing = await db.challengeEntry.findFirst({
    where: { challengeId, OR: [{ resultId: input.resultId }, { playerTokenHash }] },
  });
  if (existing) {
    throw new ChallengeConflictError(
      'Result already entered, or this player already has an entry for this challenge',
    );
  }

  const existingEntries = await db.challengeEntry.findMany({
    where: { challengeId },
    include: { result: { select: { score: true, distanceKm: true } } },
  });

  const rank =
    1 +
    existingEntries.filter(
      (entry) =>
        compareLeaderboard(
          { score: entry.result.score, distanceKm: entry.result.distanceKm },
          { score: result.score, distanceKm: result.distanceKm },
        ) < 0,
    ).length;

  const created = await db.challengeEntry.create({
    data: {
      challengeId,
      resultId: input.resultId,
      displayName: normalizeDisplayName(input.displayName),
      playerTokenHash,
    },
  });

  return { entryId: created.id, rank };
}

/**
 * Public leaderboard: entries ranked by score desc then distance asc. Only
 * entries attached to this challenge (hence only its fixed round) are returned.
 */
export async function getLeaderboard(
  challengeId: string,
  db: PrismaClient,
): Promise<LeaderboardResponse> {
  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: {
      entries: {
        include: { result: { select: { score: true, distanceKm: true } } },
      },
    },
  });

  if (!challenge) {
    throw new GameNotFoundError();
  }

  const sorted = challenge.entries
    .map((entry) => ({
      displayName: entry.displayName,
      score: entry.result.score,
      distanceKm: entry.result.distanceKm,
    }))
    .sort(compareLeaderboard);

  const entries = sorted.map((entry) => ({
    rank: rankFor(sorted, entry),
    displayName: entry.displayName,
    score: entry.score,
    distanceKm: entry.distanceKm,
  }));

  return { challengeId, entries };
}
