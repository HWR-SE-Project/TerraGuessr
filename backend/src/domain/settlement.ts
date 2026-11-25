/**
 * Shared timeout settlement for unattended rounds (R08/R16/R18).
 *
 * Ensures that timed-out rounds owned by signed-in accounts are scored and
 * archived into `GameResult` even when the player disconnects and never polls
 * the game again — both before expired-session cleanup deletes live rows and
 * when an account inspects `/api/me/results`.
 */

import type { PrismaClient } from '@prisma/client';

import { LOBBY_ROUND_REVIEW_MS } from '../config/constants.js';
import {
  archiveGameResult,
  computeElapsedSeconds,
  computeMatchPlacements,
  extractSceneMetadata,
  stampMultiplayerMatchPlacements,
} from './archive.js';
import { gameRulesFor } from './gameRules.js';
import { isDeadlinePassed } from './roundFlow.js';
import { computeScore } from './roundView.js';

export const SETTLEMENT_BATCH_SIZE = 200;

export type SettlementClient = Pick<
  PrismaClient,
  'streetRound' | 'lobby' | 'lobbyRoundResult' | '$transaction'
>;

export interface StreetSettlementScope {
  userId?: string;
  expiredGamesOnly?: boolean;
}

export interface LobbySettlementScope {
  userId?: string;
  expiredLobbiesOnly?: boolean;
}

/**
 * Settle and archive any unscored, timed-out singleplayer rounds belonging to
 * signed-in accounts. Guest sessions (`ownerUserId === null`) and rounds whose
 * deadline has not yet passed are untouched.
 */
export async function settleTimedOutStreetRounds(
  db: SettlementClient,
  now: Date = new Date(),
  scope: StreetSettlementScope = {},
): Promise<number> {
  let settled = 0;
  let cursorId: string | undefined;

  while (true) {
    const rounds = await db.streetRound.findMany({
      where: {
        score: null,
        endsAt: { lte: now },
        ...(cursorId ? { id: { gt: cursorId } } : {}),
        game: {
          ownerUserId: scope.userId ?? { not: null },
          ...(scope.expiredGamesOnly ? { expiresAt: { lt: now } } : {}),
        },
      },
      orderBy: { id: 'asc' },
      take: SETTLEMENT_BATCH_SIZE,
      include: {
        attempts: { orderBy: { attemptNumber: 'asc' } },
        game: { select: { id: true, ownerUserId: true, difficulty: true } },
      },
    });
    if (rounds.length === 0) break;

    for (const round of rounds) {
      const userId = round.game.ownerUserId;
      if (userId === null) continue;
      const actual = { lat: round.targetLat, lon: round.targetLon };
      const selection =
        round.selectionLat !== null && round.selectionLon !== null
          ? { lat: round.selectionLat, lon: round.selectionLon }
          : null;
      const { guess, distanceKm, score } = computeScore({
        attempts: round.attempts,
        selection,
        actual,
        pointsSpent: round.additionalDataPointsSpent,
        timedOut: true,
      });

      const archived = await db.$transaction(async (tx) => {
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
        const sceneMeta = extractSceneMetadata(round.sceneJson);
        const rules = gameRulesFor(round.game.difficulty);
        await archiveGameResult(tx, {
          prefix: 'solo',
          roundId: round.id,
          userId,
          mode: 'solo',
          difficulty: round.game.difficulty,
          sessionId: round.game.id,
          matchId: round.game.id,
          roundNumber: round.number,
          actual,
          evaluatedGuess: guess,
          distanceKm,
          score,
          placeName: round.placeName,
          biome: sceneMeta.biome,
          weather: sceneMeta.weather,
          temperatureBand: sceneMeta.temperatureBand,
          attemptsUsed: round.attempts.length,
          extraDataUnlocked: round.additionalDataUnlockedAt !== null,
          extraDataPointsSpent: round.additionalDataPointsSpent,
          elapsedSeconds: computeElapsedSeconds(
            round.startedAt,
            now,
            rules.timeLimitSeconds,
            true,
          ),
        });
        return true;
      });
      if (archived) settled += 1;
    }

    if (rounds.length < SETTLEMENT_BATCH_SIZE) break;
    cursorId = rounds.at(-1)!.id;
  }

  return settled;
}

/**
 * Settle and archive active multiplayer lobby rounds where EVERY pending player
 * has timed out (preserving R04/R16 shared reveal — never revealing or
 * archiving while any participant still has time remaining).
 */
export async function settleTimedOutLobbyRounds(
  db: SettlementClient,
  now: Date = new Date(),
  scope: LobbySettlementScope = {},
): Promise<number> {
  let archivedCount = 0;
  let cursorId: string | undefined;

  while (true) {
    const lobbies = await db.lobby.findMany({
      where: {
        status: 'playing',
        ...(cursorId ? { id: { gt: cursorId } } : {}),
        ...(scope.expiredLobbiesOnly ? { expiresAt: { lt: now } } : {}),
        members: { some: { userId: scope.userId ?? { not: null } } },
      },
      orderBy: { id: 'asc' },
      take: SETTLEMENT_BATCH_SIZE,
      include: {
        members: true,
        rounds: {
          where: { reviewEndsAt: null },
          include: { attempts: true, results: true, memberStates: true },
        },
      },
    });
    if (lobbies.length === 0) break;

    for (const lobby of lobbies) {
      const round = lobby.rounds.find(
        (candidate) => candidate.number === lobby.currentRound,
      );
      if (!round) continue;

      const completed = new Set(round.results.map((result) => result.memberId));
      const pending = lobby.members.filter((member) => !completed.has(member.id));
      const timedOut = pending.filter((member) => {
        const state = round.memberStates.find((s) => s.memberId === member.id);
        return isDeadlinePassed(state?.endsAt ?? round.endsAt, now);
      });
      if (timedOut.length !== pending.length) continue;

      const actual = { lat: round.targetLat, lon: round.targetLon };
      for (const member of timedOut) {
        const state = round.memberStates.find((s) => s.memberId === member.id);
        const extraDataPointsSpent = state?.extraDataPointsSpent ?? 0;
        const attempts = round.attempts.filter(
          (attempt) => attempt.memberId === member.id,
        );
        const selection =
          member.selectionLat !== null && member.selectionLon !== null
            ? { lat: member.selectionLat, lon: member.selectionLon }
            : null;
        const { guess, distanceKm, score } = computeScore({
          attempts,
          selection,
          actual,
          pointsSpent: extraDataPointsSpent,
          timedOut: true,
        });
        await db.lobbyRoundResult.upsert({
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

      const reviewEndsAt = new Date(now.getTime() + LOBBY_ROUND_REVIEW_MS);
      const archivedInRound = await db.$transaction(async (tx) => {
        const claim = await tx.lobbyRound.updateMany({
          where: {
            id: round.id,
            reviewEndsAt: null,
            lobby: {
              id: lobby.id,
              matchId: lobby.matchId,
              status: 'playing',
              currentRound: round.number,
            },
          },
          data: { reviewEndsAt },
        });
        if (!claim.count) return 0;

        const results = await tx.lobbyRoundResult.findMany({
          where: { roundId: round.id },
          include: { member: { select: { userId: true } } },
        });
        const memberStateByMemberId = new Map(
          round.memberStates.map((state) => [state.memberId, state]),
        );
        const sceneMeta = extractSceneMetadata(round.sceneJson);
        const rules = gameRulesFor(lobby.difficulty);
        const timedOutMemberIds = new Set(timedOut.map((member) => member.id));
        let count = 0;
        for (const result of results) {
          if (result.member.userId === null) continue;
          const memberState = memberStateByMemberId.get(result.memberId);
          await archiveGameResult(tx, {
            prefix: 'lobby',
            roundId: result.id,
            userId: result.member.userId,
            mode: 'multiplayer',
            difficulty: lobby.difficulty,
            sessionId: round.lobbyId,
            matchId: lobby.matchId,
            roundNumber: round.number,
            actual: {
              lat: result.actualLat ?? round.targetLat,
              lon: result.actualLon ?? round.targetLon,
            },
            evaluatedGuess:
              result.guessLat !== null && result.guessLon !== null
                ? { lat: result.guessLat, lon: result.guessLon }
                : null,
            distanceKm: result.distanceKm,
            score: result.score,
            placeName: round.placeName,
            biome: sceneMeta.biome,
            weather: sceneMeta.weather,
            temperatureBand: sceneMeta.temperatureBand,
            attemptsUsed: result.attemptsUsed,
            extraDataUnlocked:
              memberState?.extraDataUnlockedAt != null ||
              result.extraDataPointsSpent > 0,
            extraDataPointsSpent: result.extraDataPointsSpent,
            elapsedSeconds: computeElapsedSeconds(
              round.startedAt,
              result.createdAt,
              rules.timeLimitSeconds,
              timedOutMemberIds.has(result.memberId),
            ),
          });
          count += 1;
        }
        if (round.number >= lobby.roundsTotal) {
          const allMatchResults = await tx.lobbyRoundResult.findMany({
            where: { round: { lobbyId: lobby.id } },
            select: { memberId: true, score: true },
          });
          const placements = computeMatchPlacements(lobby.members, allMatchResults);
          await stampMultiplayerMatchPlacements(tx, lobby.matchId, placements);
        }
        return count;
      });
      archivedCount += archivedInRound;
    }

    if (lobbies.length < SETTLEMENT_BATCH_SIZE) break;
    cursorId = lobbies.at(-1)!.id;
  }

  return archivedCount;
}

/**
 * Settle any timed-out solo rounds (and fully timed-out multiplayer rounds)
 * for a signed-in user before serving `/api/me/results`.
 */
export async function settleTimedOutResultsForUser(
  db: SettlementClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const [solo, lobby] = await Promise.all([
    settleTimedOutStreetRounds(db, now, { userId }),
    settleTimedOutLobbyRounds(db, now, { userId }),
  ]);
  return solo + lobby;
}
