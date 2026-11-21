import type { StreetResult } from '../api/singleplayer'
import { coordinates, distanceLabel } from '../lib/format'

type Result = Pick<StreetResult, 'score' | 'guess' | 'actual' | 'distanceKm' | 'extraDataPointsSpent'>

/** The score, distance and coordinates have identical meaning in both game modes. */
export function RoundResultDetails({ result, tutorialAnchor = false }: { result: Result; tutorialAnchor?: boolean }) {
  const { score, guess, actual, distanceKm, extraDataPointsSpent = 0 } = result
  return <>
    <h1>{score >= 4500 ? 'Incredible instinct.' : score >= 2500 ? 'Nicely explored.' : 'Every guess is a discovery.'}</h1>
    <p data-tutorial-distance={tutorialAnchor || undefined}>
      {guess ? <>You were <strong>{distanceLabel(distanceKm)}</strong> from the correct location.</> : 'You ran out of time before placing a guess.'}
    </p>
    <div className="sp-earned" data-tutorial-points={tutorialAnchor || undefined}>
      <strong>{score.toLocaleString()}</strong><span> / 5,000 points</span>
    </div>
    <div className="sp-score-track"><span style={{ width: `${score / 50}%` }} /></div>
    {extraDataPointsSpent > 0 && <p className="sp-result-extra">Additional data: −{extraDataPointsSpent} points</p>}
    <div className="sp-result-coords">
      <span>Correct location<strong>{coordinates(actual)}</strong></span>
      <span>Your guess<strong>{coordinates(guess)}</strong></span>
    </div>
  </>
}
