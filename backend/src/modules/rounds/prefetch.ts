/**
 * Per-game round prefetch (R12, architecture.md §6a).
 *
 * After a round is started, the next round's location and weather snapshot are
 * selected and cached on `Game.nextLocationId` / `Game.nextWeatherSnapshotId`.
 * `startRound` consumes that pending selection on its fast path, so this is a
 * pure latency optimization: correctness never depends on the prefetch having
 * run. Every step here is therefore best-effort — any failure is swallowed.
 */

import type { PrismaClient } from '@prisma/client';

import { selectRound } from '../../domain/selection.js';
import type { Rng } from '../../domain/selection.js';
import { LocationsService } from '../locations/service.js';
import { getFreshSnapshot } from '../weather/cache.js';
import type { WeatherClient } from '../weather/types.js';

/** A challenge game has exactly one shared round (ADR-0005/ADR-0008). */
function roundCap(mode: 'solo' | 'challenge', roundsTotal: number): number {
  return mode === 'solo' ? roundsTotal : 1;
}

/**
 * Select the location and weather for the round *after* the current one and
 * store them on the game's `next*` columns. Excluding the used ids (which
 * already include the just-created current round) guarantees the next location
 * is distinct (R02). Best-effort: any error is swallowed so a failed prefetch
 * can never break the round workflow.
 */
export async function prefetchNextRound(
  gameId: string,
  db: PrismaClient,
  weatherClient: WeatherClient,
  rng: Rng = Math.random,
): Promise<void> {
  try {
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: {
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: { location: { select: { lat: true, lon: true } } },
        },
      },
    });

    if (!game || game.status === 'completed') {
      return;
    }
    // No next round exists once the game is at/over its round cap.
    if (game.rounds.length >= roundCap(game.mode, game.roundsTotal)) {
      return;
    }

    const locations = new LocationsService(db);
    const pool = await locations.listPool();
    const usedIds = new Set(await locations.usedLocationIds(gameId));
    const previousActuals = game.rounds.map((round) => ({
      lat: round.location.lat,
      lon: round.location.lon,
    }));

    const selection = selectRound({
      difficulty: game.difficulty,
      pool,
      usedIds,
      previousActuals,
      rng,
    });

    const snapshot = await getFreshSnapshot(
      db,
      weatherClient,
      selection.actual.id,
    );

    await db.game.update({
      where: { id: gameId },
      data: {
        nextLocationId: selection.actual.id,
        nextWeatherSnapshotId: snapshot.id,
      },
    });
  } catch {
    // Best-effort: never let a failed prefetch affect the round workflow.
  }
}
