import { useState } from 'react'
import type { LatLon, RoundDTO } from '../../api/types'
import { WeatherPanel } from '../../components/WeatherPanel'
import { MapPicker } from '../../components/map/MapPicker'
import './DuelRoundOverlay.css'

export interface DuelRoundOverlayProps {
  round: RoundDTO | null
  creating: boolean
  busy: boolean
  error: string | null
  onSubmit: (guess: LatLon) => void
  onClose: () => void
}

export function DuelRoundOverlay({ round, creating, busy, error, onSubmit, onClose }: DuelRoundOverlayProps) {
  const [guess, setGuess] = useState<LatLon | null>(null)

  return (
    <div className="tg-duel-overlay-scrim" role="presentation">
      <div className="tg-duel-overlay" role="dialog" aria-modal="true" aria-label="Play this duel location">
        <button type="button" className="tg-duel-overlay-close" onClick={onClose} aria-label="Cancel">
          ×
        </button>

        {error && !round ? (
          <>
            <p className="tg-duel-overlay-error" role="alert">{error}</p>
            <button type="button" className="tg-duel-overlay-submit" onClick={onClose}>
              Close
            </button>
          </>
        ) : !round ? (
          <p className="tg-duel-overlay-loading">Preparing your location…</p>
        ) : creating ? (
          <p className="tg-duel-overlay-loading">Creating your duel link…</p>
        ) : (
          <>
            <h2 className="tg-duel-overlay-title">Where is this?</h2>
            <p className="tg-duel-overlay-lead">Your guess locks in the location — then you'll get a link to challenge a friend to beat it.</p>
            <div className="tg-duel-overlay-body">
              <WeatherPanel weather={round.weather} access={round.additionalData} />
              <div className="tg-duel-overlay-map">
                <MapPicker guess={guess} onChange={setGuess} />
              </div>
            </div>
            {error && <p className="tg-duel-overlay-error" role="alert">{error}</p>}
            <button type="button" className="tg-duel-overlay-submit" disabled={!guess || busy} onClick={() => guess && onSubmit(guess)}>
              {busy ? 'Submitting…' : 'Lock in guess & create duel link'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
