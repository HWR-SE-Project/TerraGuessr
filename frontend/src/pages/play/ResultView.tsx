import type { GuessResultDTO, LatLon } from '../../api/types'
import { MapPicker } from '../../components/map/MapPicker'
import './PlayPage.css'

export interface ResultViewProps {
  guess: LatLon
  result: GuessResultDTO
  roundNumber: number
  roundsTotal: number
  onNext: () => void
  advancing: boolean
  onCreateChallenge: () => void
  creatingChallenge: boolean
  challengeError: string | null
}

export function ResultView({
  guess,
  result,
  roundNumber,
  roundsTotal,
  onNext,
  advancing,
  onCreateChallenge,
  creatingChallenge,
  challengeError,
}: ResultViewProps) {
  const isLastRound = roundNumber >= roundsTotal

  return (
    <div className="tg-play-result">
      <div className="tg-play-result-score">
        <span className="tg-play-result-score-value">{result.score.toLocaleString()}</span>
        <span className="tg-play-result-score-label">points · {result.distanceKm.toFixed(1)} km away</span>
      </div>

      <div className="tg-play-result-map">
        <MapPicker guess={guess} actual={result.actual} onChange={() => {}} interactive={false} zoom={3} center={result.actual} />
      </div>

      {challengeError && <p className="tg-play-error" role="alert">{challengeError}</p>}

      <div className="tg-play-result-actions">
        <button type="button" className="tg-play-secondary tg-control" disabled={creatingChallenge} onClick={onCreateChallenge}>
          {creatingChallenge ? 'Creating…' : 'Challenge a friend to this round'}
        </button>
        <button type="button" className="tg-play-cta tg-control tg-control--primary" disabled={advancing} onClick={onNext}>
          {advancing ? 'Loading…' : isLastRound ? 'View summary' : 'Next round'}
        </button>
      </div>
    </div>
  )
}
