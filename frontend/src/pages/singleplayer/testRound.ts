import type { StreetRound } from '../../api/singleplayer'

/** Complete StreetRound fixture for UI/controller tests. */
export function testRound(
  round: Pick<StreetRound, 'id' | 'number' | 'panoId'> &
    Partial<StreetRound>,
): StreetRound {
  return {
    startedAt: null,
    endsAt: null,
    attemptsUsed: 0,
    attemptsTotal: 2,
    extraData: {
      mode: 'immediate',
      cost: null,
      availableAt: null,
      unlocked: true,
      pointsSpent: 0,
    },
    ...round,
  }
}
