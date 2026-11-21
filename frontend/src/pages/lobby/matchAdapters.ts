import type { LobbyMatchDTO, LobbyMatchResult } from '../../api/types'
import type { StreetResult, StreetRound } from '../../api/singleplayer'

/**
 * Adapters that let the lobby match use the same Street View/result
 * components as singleplayer. Kept pure and outside the page component so
 * they can be unit-tested.
 */

export function asStreetRound(
  round: LobbyMatchDTO['round'],
): StreetRound | null {
  if (!round) return null
  return {
    id: round.id,
    number: round.number,
    panoId: round.panoId,
    ...(round.candidates?.length ? { candidates: round.candidates } : {}),
    startedAt: null,
    endsAt: round.endsAt,
    attemptsUsed: round.attemptsUsed,
    attemptsTotal: round.attemptsTotal,
    extraData: round.extraData,
  }
}

/**
 * R11: adapt every lobby result, including rounds without a submitted guess.
 * `guess`/`distanceKm` stay null, but `actual` is preserved so the result map
 * can always render the actual-location marker.
 */
export function asStreetResults(results: LobbyMatchResult[]): StreetResult[] {
  return results.map((result) => ({
    roundId: `round-${result.roundNumber}`,
    number: result.roundNumber,
    guess: result.guess,
    actual: result.actual,
    distanceKm: result.distanceKm,
    score: result.score,
  }))
}
