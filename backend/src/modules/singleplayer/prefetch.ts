import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { PanoramaProvider, PanoramaTarget } from './provider.js';
import type { IntelligenceLookup, PanoramaLocator } from './locationSelection.js';
import { nextExclusions, selectRoundWithWeather } from './locationSelection.js';
import { PanoramaError } from './providerErrors.js';

/**
 * In-flight singleplayer round preparations keyed by `<gameId>:<roundNumber>`.
 * Shared between background prefetch (started when round N begins) and
 * foreground `POST .../rounds` so they never duplicate provider/weather calls
 * or exceed the 3-location R13 budget.
 */
const inFlightPreparations = new Map<string, Promise<void>>();

function prepKey(gameId: string, roundNumber: number): string {
  return `${gameId}:${roundNumber}`;
}

/** Return the in-flight preparation promise for `(gameId, roundNumber)`, if any. */
export function pendingStreetPrefetch(
  gameId: string,
  roundNumber: number,
): Promise<void> | undefined {
  return inFlightPreparations.get(prepKey(gameId, roundNumber));
}

/**
 * Single shared preparation record for upcoming round `roundNumber` (R12/R13).
 * Starts as soon as round `roundNumber - 1` begins (and re-verifies on round
 * finalization if weather expired), stores target + scene + expiry + attempted
 * indices, and caps distinct locations fetched at 3 across prefetch and start.
 */
export function prefetchNextStreetRound(
  gameId: string,
  roundNumber: number,
  db: Pick<PrismaClient, 'streetGame'>,
  provider: PanoramaProvider,
  intelligence: IntelligenceLookup,
  locate?: PanoramaLocator,
): Promise<void> {
  const key = prepKey(gameId, roundNumber);
  const existing = inFlightPreparations.get(key);
  if (existing) return existing;

  const job = (async () => {
    try {
      const game = await db.streetGame.findUnique({
        where: { id: gameId },
        include: {
          rounds: { orderBy: { number: 'asc' }, select: { number: true, targetIndex: true } },
        },
      });
      if (!game) return;
      if (game.roundsTotal != null && roundNumber > game.roundsTotal) return;
      if (game.rounds.length + 1 !== roundNumber) return;

      const sameRound =
        game.nextRoundNumber === roundNumber ||
        (game.nextRoundNumber === null && game.nextPanoId !== null);

      if (sameRound && game.nextExhausted) return;
      if (
        sameRound &&
        game.nextPanoId !== null &&
        game.nextSceneJson !== null &&
        game.nextWeatherValidUntil !== null &&
        game.nextWeatherValidUntil.getTime() > Date.now()
      ) {
        return; // Already prepared with fresh weather.
      }
      if (
        sameRound &&
        game.nextPanoId !== null &&
        game.nextWeatherValidUntil === null
      ) {
        // Preserve a pre-seeded/legacy target so startRound validates/consumes it.
        return;
      }

      const used = game.rounds.map((r) => r.targetIndex);
      const alreadyAttempted = sameRound ? game.nextAttemptedIndices : [];
      const expiredTarget: PanoramaTarget | undefined =
        sameRound &&
        game.nextPanoId !== null &&
        game.nextTargetIndex !== null &&
        game.nextTargetLat !== null &&
        game.nextTargetLon !== null
          ? {
              panoId: game.nextPanoId,
              targetIndex: game.nextTargetIndex,
              lat: game.nextTargetLat,
              lon: game.nextTargetLon,
            }
          : undefined;

      try {
        const prepared = await selectRoundWithWeather(
          nextExclusions(used),
          provider,
          intelligence,
          { locate, prefetched: expiredTarget, alreadyAttempted },
        );
        await db.streetGame.updateMany({
          where: {
            id: gameId,
            OR: [
              { nextRoundNumber: null },
              { nextRoundNumber: { lte: roundNumber } },
            ],
          },
          data: {
            nextRoundNumber: roundNumber,
            nextTargetIndex: prepared.target.targetIndex,
            nextPanoId: prepared.target.panoId,
            nextTargetLat: prepared.target.lat,
            nextTargetLon: prepared.target.lon,
            nextSceneJson: prepared.scene as unknown as Prisma.InputJsonValue,
            nextWeatherValidUntil: prepared.weatherValidUntil,
            nextAttemptedIndices: prepared.attemptedIndices,
            nextExhausted: false,
          },
        });
      } catch (error) {
        if (error instanceof PanoramaError && error.code === 'WEATHER_UNAVAILABLE') {
          await db.streetGame.updateMany({
            where: {
              id: gameId,
              OR: [
                { nextRoundNumber: null },
                { nextRoundNumber: { lte: roundNumber } },
              ],
            },
            data: {
              nextRoundNumber: roundNumber,
              nextTargetIndex: null,
              nextPanoId: null,
              nextTargetLat: null,
              nextTargetLon: null,
              nextSceneJson: Prisma.DbNull,
              nextWeatherValidUntil: null,
              nextAttemptedIndices: [...(error.attemptedIndices ?? alreadyAttempted)],
              nextExhausted: true,
            },
          });
        }
      }
    } catch {
      // Best-effort: never let an unhandled background rejection crash the process.
    }
  })().finally(() => {
    inFlightPreparations.delete(key);
  });

  inFlightPreparations.set(key, job);
  return job;
}
