import { useState } from 'react'
import type { LatLon, RoundDTO } from '../../api/types'
import { WeatherPanel } from '../../components/WeatherPanel'
import { MapPicker } from '../../components/map/MapPicker'
import { CandidateList } from '../../components/CandidateList'
import './PlayPage.css'

export interface RoundViewProps {
  round: RoundDTO
  roundsTotal: number
  onSubmit: (guess: LatLon) => void
  submitting: boolean
  error: string | null
  onUnlock: () => void
  unlocking: boolean
  unlockError: string | null
}

export function RoundView({ round, roundsTotal, onSubmit, submitting, error, onUnlock, unlocking, unlockError }: RoundViewProps) {
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  function handleCandidateChange(next: LatLon) {
    setGuess(next)
    const match = round.candidates?.find((candidate) => candidate.lat === next.lat && candidate.lon === next.lon)
    setSelectedCandidateId(match?.id ?? null)
  }

  return (
    <div className="tg-play-round">
      <div className="tg-play-round-header">
        <span className="tg-play-round-progress">
          Round {round.roundNumber} / {roundsTotal}
        </span>
        <span className="tg-play-round-difficulty">{round.difficulty}</span>
      </div>

      <div className="tg-play-round-body">
        <div className="tg-play-round-weather">
          <WeatherPanel weather={round.weather} access={round.additionalData} unlocking={unlocking} unlockError={unlockError} onUnlock={onUnlock} />
        </div>

        <div className="tg-play-round-picker">
          {round.selectionMode === 'map' ? (
            <MapPicker guess={guess} onChange={setGuess} />
          ) : (
            <CandidateList candidates={round.candidates ?? []} onChange={handleCandidateChange} selectedId={selectedCandidateId} />
          )}
        </div>
      </div>

      {error && <p className="tg-play-error" role="alert">{error}</p>}

      <button type="button" className="tg-play-cta tg-control tg-control--primary" disabled={!guess || submitting} onClick={() => guess && onSubmit(guess)}>
        {submitting ? 'Submitting…' : 'Submit guess'}
      </button>
    </div>
  )
}
