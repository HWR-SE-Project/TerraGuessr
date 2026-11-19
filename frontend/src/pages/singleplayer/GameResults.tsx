import { Button } from '../../components/ui/Button'
import type { StreetResult, StreetSession } from '../../api/singleplayer'
import type { LatLon } from '../../api/types'
import { GuessMap } from './GuessMap'
function distanceLabel(km: number) {
  return km < 1
    ? `${Math.round(km * 1000).toLocaleString()} m`
    : `${km.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`
}
function coordinates(point: LatLon) {
  return `${Math.abs(point.lat).toFixed(3)}° ${point.lat >= 0 ? 'N' : 'S'}, ${Math.abs(point.lon).toFixed(3)}° ${point.lon >= 0 ? 'E' : 'W'}`
}
function Legend() {
  return (
    <div className="sp-map-legend">
      <span>
        <i />
        Correct location
      </span>
      <span>
        <i />
        Your guess
      </span>
    </div>
  )
}
export function RoundResults({
  result,
  roundsTotal,
  onNext,
  busy,
}: {
  result: StreetResult
  roundsTotal: number
  onNext: () => void
  busy: boolean
}) {
  return (
    <section className="sp-results" aria-label="Round results">
      <div className="sp-result-map">
        <GuessMap key={result.roundId} results={[result]} interactive={false} />
        <Legend />
      </div>
      <div className="sp-result-body">
        <span className="sp-eyebrow">
          ROUND {result.number} OF {roundsTotal} COMPLETE
        </span>
        <h1>
          {result.score >= 4500
            ? 'Incredible instinct.'
            : result.score >= 2500
              ? 'Nicely explored.'
              : 'Every guess is a discovery.'}
        </h1>
        <p>
          You were <strong>{distanceLabel(result.distanceKm)}</strong> from the
          correct location.
        </p>
        <div className="sp-earned">
          <strong>{result.score.toLocaleString()}</strong>
          <span> / 5,000 points</span>
        </div>
        <div className="sp-score-track">
          <span style={{ width: `${result.score / 50}%` }} />
        </div>
        <div className="sp-result-coords">
          <span>
            Correct location<strong>{coordinates(result.actual)}</strong>
          </span>
          <span>
            Your guess<strong>{coordinates(result.guess)}</strong>
          </span>
        </div>
      </div>
      <footer className="sp-result-actions">
        <Button className="sp-primary" disabled={busy} onClick={onNext}>
          {busy
            ? 'Loading next location…'
            : result.number === roundsTotal
              ? 'View final results'
              : 'Next round'}{' '}
          <span aria-hidden="true">→</span>
        </Button>
      </footer>
    </section>
  )
}
export function FinalResults({
  session,
  onPlayAgain,
  onHome,
  busy,
}: {
  session: StreetSession
  onPlayAgain: () => void
  onHome: () => void
  busy: boolean
}) {
  return (
    <section className="sp-results sp-final" aria-label="Final results">
      <div className="sp-result-map">
        <GuessMap
          key={session.id}
          results={session.results}
          interactive={false}
        />
        <Legend />
      </div>
      <div className="sp-result-body">
        <span className="sp-eyebrow">WORLD EXPLORER · EXPEDITION COMPLETE</span>
        <h1>A world of discoveries.</h1>
        <div className="sp-earned">
          <strong>{session.totalScore.toLocaleString()}</strong>
          <span> / {(session.roundsTotal * 5000).toLocaleString()} points</span>
        </div>
        <p aria-label="Total distance">
          Total distance:{' '}
          <strong>
            {distanceLabel(
              session.results.reduce(
                (sum, result) => sum + result.distanceKm,
                0,
              ),
            )}
          </strong>
        </p>
        <div className="sp-round-list">
          {session.results.map((result) => (
            <details key={result.roundId}>
              <summary>
                <span>Round {result.number}</span>
                <span>{distanceLabel(result.distanceKm)}</span>
                <strong>{result.score.toLocaleString()} pts</strong>
              </summary>
              <div>
                <p>Correct location: {coordinates(result.actual)}</p>
                <p>Your guess: {coordinates(result.guess)}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
      <footer className="sp-result-actions">
        <Button className="sp-primary" disabled={busy} onClick={onPlayAgain}>
          {busy ? 'Starting…' : 'Play again'} <span aria-hidden="true">↗</span>
        </Button>
        <Button
          variant="secondary"
          className="sp-secondary"
          disabled={busy}
          onClick={onHome}
        >
          Return home
        </Button>
      </footer>
    </section>
  )
}
