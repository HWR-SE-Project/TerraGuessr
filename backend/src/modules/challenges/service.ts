/**
 * Async challenges service (B-10, R16/ADR-0005).
 *
 * A challenge pins one finished round (roundId @unique) so many players can
 * attach their results and compare on a public leaderboard. No WebSockets, no
 * live presence — just an immutable share link plus ranked entries (B.3/B.6).
 */

import type { PrismaClient } from '@prisma/client';

import { GameNotFoundError } from '../../plugins/auth.js';
import type {
  CreateChallengeResponse,
  CreateEntryResponse,
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
 * Attach a completed result to a challenge leaderboard. The result must belong
 * to the challenge's fixed round (409 otherwise) and may only be entered once
 * (409 on duplicate). Ownership of the result is enforced upstream.
 */
export async function addEntry(
  challengeId: string,
  input: { resultId: string; displayName?: string },
  db: PrismaClient,
): Promise<CreateEntryResponse> {
  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
  });
  if (!challenge) {
    throw new GameNotFoundError();
  }

  const result = await db.result.findUnique({ where: { id: input.resultId } });
  if (!result) {
    throw new GameNotFoundError();
  }

  if (result.roundId !== challenge.roundId) {
    throw new ChallengeConflictError('Result is not for this challenge round');
  }

  const existing = await db.challengeEntry.findFirst({
    where: { challengeId, resultId: input.resultId },
  });
  if (existing) {
    throw new ChallengeConflictError('Result already entered');
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
