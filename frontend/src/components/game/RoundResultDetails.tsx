import type { ReactNode } from 'react'
import type { EvaluatedAttempt, LatLon } from '../../lib/contracts'
import { formatDistance, formatScore } from '../../lib/format'
import { GuessMap } from './GuessMap'
import type { MapMarker } from './GuessMap'

export function RoundResultDetails({ result, markers = [], sideContent }: {
  result: {
    actual: LatLon
    placeName?: string | null
    guess: LatLon | null
    distanceKm: number | null
    score: number
    attempts?: EvaluatedAttempt[]
  }
  markers?: MapMarker[]
  sideContent?: ReactNode
}) {
  const attempts = result.attempts ?? []
  const multipleAttempts = attempts.length > 1
  const otherAttemptMarkers: MapMarker[] = attempts
    .filter((attempt) => !attempt.isBest)
    .map((attempt) => ({
      position: attempt.guess,
      title: `Attempt #${attempt.attemptNumber} (${formatDistance(attempt.distanceKm)})`,
      color: '#64748b',
    }))
  const combinedMarkers = [...otherAttemptMarkers, ...markers]

  return (
    <div className="flex flex-col gap-4">
      {result.placeName && (
        <p className="text-center font-display text-lg font-semibold text-cream">
          Actual location: <span className="text-lime-300">{result.placeName}</span>
        </p>
      )}
      <div className="flex items-end justify-center gap-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-subtle">Distance</p>
          <p className="font-display text-3xl font-semibold text-cream">{formatDistance(result.distanceKm)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-subtle">Points</p>
          <p className="font-display text-3xl font-semibold text-lime-300">+{formatScore(result.score)}</p>
        </div>
      </div>
      {multipleAttempts && (
        <p className="text-center text-xs text-muted">
          Scored from your closest of {attempts.length} submitted attempts.
        </p>
      )}
      <div className={sideContent ? 'grid items-start gap-4 sm:grid-cols-2' : undefined}>
        {sideContent && <div className="min-w-0 sm:order-2">{sideContent}</div>}
        <div className="h-56 overflow-hidden rounded-2xl">
          <GuessMap
            interactive={false}
            markers={combinedMarkers}
            results={[{ actual: result.actual, guess: result.guess, label: multipleAttempts ? 'Your best guess' : 'Your guess' }]}
          />
        </div>
      </div>
    </div>
  )
}
