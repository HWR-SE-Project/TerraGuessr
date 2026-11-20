import type { GameResultsDTO } from '../../api/types'
import './PlayPage.css'

export interface SummaryViewProps {
  results: GameResultsDTO
  onPlayAgain: () => void
}

export function SummaryView({ results, onPlayAgain }: SummaryViewProps) {
  return (
    <div className="tg-play-summary">
      <div className="tg-play-eyebrow">Expedition complete</div>
      <h1 className="tg-play-title">{results.totalScore.toLocaleString()} points</h1>

      <ul className="tg-play-summary-list">
        {results.results
          .slice()
          .sort((a, b) => a.roundNumber - b.roundNumber)
          .map((entry) => (
            <li key={entry.resultId} className="tg-play-summary-row">
              <span>Round {entry.roundNumber}</span>
              <span>{entry.distanceKm.toFixed(1)} km</span>
              <span className="tg-play-summary-score">{entry.score.toLocaleString()} pts</span>
            </li>
          ))}
      </ul>

      <button type="button" className="tg-play-cta tg-control tg-control--primary" onClick={onPlayAgain}>
        Play again
      </button>
    </div>
  )
}
