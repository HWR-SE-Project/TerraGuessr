import type { PrismaClient } from '@prisma/client';
import type { PanoramaProvider } from './provider.js';
import type { IntelligenceLookup } from './locationSelection.js';
import { nextExclusions, selectValidatedTarget } from './locationSelection.js';

/**
 * Best-effort prefetch of the round after the one just completed (R12).
 * Prefetches the next target after a round is scored so the next round can
 * start without another provider round-trip.
 * correctness never depends on this having run — `POST .../rounds` falls
 * back to a synchronous, weather-validated selection when no prefetch is
 * cached (or it was already consumed). Every failure here is swallowed so a
 * failed prefetch can never affect the round workflow.
 */
export async function prefetchNextStreetRound(
  gameId: string,
  db: Pick<PrismaClient, 'streetGame'>,
  provider: PanoramaProvider,
  intelligence: IntelligenceLookup,
): Promise<void> {
  try {
    const game = await db.streetGame.findUnique({
      where: { id: gameId },
      include: { rounds: { select: { targetIndex: true } } },
    });
    if (!game) return;
    if (game.nextPanoId) return; // Already cached; don't spend another API call.
    // Endless mode: there is always a next round, so always try to prefetch
    // one. R08: once the pool is exhausted, only avoid an immediate repeat.
    const used = game.rounds.map((r) => r.targetIndex);
    const target = await selectValidatedTarget(
      nextExclusions(used),
      provider,
      intelligence,
    );
    // Plain update: a lost race just means the next POST /rounds call
    // recomputes synchronously instead of hitting this cache.
    await db.streetGame.update({
      where: { id: gameId },
      data: {
        nextTargetIndex: target.targetIndex,
        nextPanoId: target.panoId,
        nextTargetLat: target.lat,
        nextTargetLon: target.lon,
      },
    });
  } catch {
    // Best-effort: never let a failed prefetch affect the round workflow.
  }
}
