/**
 * Shared durable-result archiving (R18).
 *
 * Singleplayer and lobbies both upsert a `GameResult` row when a signed-in
 * player's round finalizes. The only differences are where the ids live
 * (`solo:<StreetRound.id>` vs `lobby:<LobbyRoundResult.id>`) and which
 * session/match ids they carry, so a single function owns the upsert.
 */

import type { Difficulty, GameMode, Prisma } from '@prisma/client';

import type { LatLon } from './distance.js';
import { BIOMES, SCENE_WEATHERS, TEMPERATURE_BANDS } from './scene.js';

export interface SceneArchiveMetadata {
  biome: string | null;
  weather: string | null;
  temperatureBand: string | null;
}

export interface ArchiveRoundInput {
  /** Deterministic id prefix: `solo:<roundId>` or `lobby:<resultId>`. */
  prefix: 'solo' | 'lobby';
  roundId: string;
  userId: string;
  mode: GameMode;
  difficulty: Difficulty;
  sessionId: string;
  matchId: string;
  roundNumber: number;
  actual: LatLon;
  /** The evaluated guess (closest submitted attempt, or timeout selection fallback; null if none). */
  evaluatedGuess: LatLon | null;
  distanceKm: number | null;
  score: number;
  placeName?: string | null;
  biome?: string | null;
  weather?: string | null;
  temperatureBand?: string | null;
  attemptsUsed?: number | null;
  extraDataUnlocked?: boolean | null;
  extraDataPointsSpent?: number | null;
  elapsedSeconds?: number | null;
  matchPlacement?: number | null;
  matchPlayerCount?: number | null;
}

const BIOME_SET: ReadonlySet<string> = new Set(BIOMES);
const WEATHER_SET: ReadonlySet<string> = new Set(SCENE_WEATHERS);
const TEMP_SET: ReadonlySet<string> = new Set(TEMPERATURE_BANDS);

/** Safely extract biome / weather / temperatureBand from a round's `sceneJson`. */
export function extractSceneMetadata(sceneJson: unknown): SceneArchiveMetadata {
  if (!sceneJson || typeof sceneJson !== 'object') {
    return { biome: null, weather: null, temperatureBand: null };
  }
  const obj = sceneJson as Record<string, unknown>;
  return {
    biome:
      typeof obj.biome === 'string' && BIOME_SET.has(obj.biome)
        ? obj.biome
        : null,
    weather:
      typeof obj.weather === 'string' && WEATHER_SET.has(obj.weather)
        ? obj.weather
        : null,
    temperatureBand:
      typeof obj.temperatureBand === 'string' && TEMP_SET.has(obj.temperatureBand)
        ? obj.temperatureBand
        : null,
  };
}

/**
 * Compute elapsed seconds for a round, clamped to `[0, timeLimitSeconds]`.
 * Returns `timeLimitSeconds` on timeout, or `null` if start time is unknown.
 */
export function computeElapsedSeconds(
  startedAt: Date | null | undefined,
  endedAt: Date,
  timeLimitSeconds: number,
  timedOut = false,
): number | null {
  if (timedOut) return Math.max(0, Math.round(timeLimitSeconds));
  if (!startedAt) return null;
  const raw = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(Math.round(timeLimitSeconds), raw));
}

export interface MatchPlacementEntry {
  userId: string;
  placement: number;
  playerCount: number;
}

/**
 * Compute standard competition rankings (1, 1, 3...) for a finished multiplayer
 * match across all lobby members. Only signed-in members are returned for
 * archiving, while `playerCount` reflects all participants in the match.
 */
export function computeMatchPlacements(
  members: Array<{ id: string; userId: string | null; displayName?: string | null }>,
  allResults: Array<{ memberId: string; score: number }>,
): MatchPlacementEntry[] {
  const playerCount = members.length;
  if (playerCount === 0) return [];

  const totals = new Map<string, { score: number; rounds: number }>();
  for (const result of allResults) {
    const prev = totals.get(result.memberId);
    if (prev) {
      prev.score += result.score;
      prev.rounds += 1;
    } else {
      totals.set(result.memberId, { score: result.score, rounds: 1 });
    }
  }

  const ranked = members
    .map((member) => {
      const entry = totals.get(member.id);
      return {
        userId: member.userId,
        displayName: member.displayName ?? '',
        totalScore: entry?.score ?? 0,
        roundsCompleted: entry?.rounds ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        b.roundsCompleted - a.roundsCompleted ||
        a.displayName.localeCompare(b.displayName),
    );

  const placements: MatchPlacementEntry[] = [];
  let currentRank = 1;
  for (let i = 0; i < ranked.length; i++) {
    const item = ranked[i]!;
    if (i > 0 && item.totalScore < ranked[i - 1]!.totalScore) {
      currentRank = i + 1;
    }
    if (item.userId !== null) {
      placements.push({
        userId: item.userId,
        placement: currentRank,
        playerCount,
      });
    }
  }
  return placements;
}

/**
 * Stamp final multiplayer placement onto all archived `GameResult` rows
 * belonging to a completed match.
 */
export async function stampMultiplayerMatchPlacements(
  tx: Prisma.TransactionClient,
  matchId: string,
  placements: MatchPlacementEntry[],
): Promise<void> {
  for (const entry of placements) {
    await tx.gameResult.updateMany({
      where: { userId: entry.userId, matchId },
      data: {
        matchPlacement: entry.placement,
        matchPlayerCount: entry.playerCount,
      },
    });
  }
}

/**
 * Upsert a `GameResult` archive row. Called inside the same transaction that
 * locks the round score so a failed archive never leaves a completed round
 * permanently unarchived.
 */
export function archiveGameResult(
  tx: Prisma.TransactionClient,
  input: ArchiveRoundInput,
) {
  const id = `${input.prefix}:${input.roundId}`;
  return tx.gameResult.upsert({
    where: { id },
    create: {
      id,
      userId: input.userId,
      mode: input.mode,
      difficulty: input.difficulty,
      sessionId: input.sessionId,
      matchId: input.matchId,
      roundNumber: input.roundNumber,
      actualLat: input.actual.lat,
      actualLon: input.actual.lon,
      guessLat: input.evaluatedGuess?.lat ?? null,
      guessLon: input.evaluatedGuess?.lon ?? null,
      distanceKm: input.distanceKm,
      score: input.score,
      placeName: input.placeName ?? null,
      biome: input.biome ?? null,
      weather: input.weather ?? null,
      temperatureBand: input.temperatureBand ?? null,
      attemptsUsed: input.attemptsUsed ?? null,
      extraDataUnlocked: input.extraDataUnlocked ?? null,
      extraDataPointsSpent: input.extraDataPointsSpent ?? null,
      elapsedSeconds: input.elapsedSeconds ?? null,
      matchPlacement: input.matchPlacement ?? null,
      matchPlayerCount: input.matchPlayerCount ?? null,
    },
    update: {},
  });
}
