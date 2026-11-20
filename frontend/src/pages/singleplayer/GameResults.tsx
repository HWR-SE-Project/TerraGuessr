import { Button } from '../../components/ui/Button'
import type { StreetResult, StreetSession } from '../../api/singleplayer'
import type { LatLon } from '../../api/types'
import { GuessMap } from './GuessMap'
import { DIFFICULTY_LEVELS } from './difficulty'
function distanceLabel(km: number) {
  return `${km.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
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
  onNext,
  busy,
}: {
  result: StreetResult
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
        <span className="sp-eyebrow">ROUND {result.number} COMPLETE</span>
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
        <Button className="sp-primary tg-control tg-control--primary" disabled={busy} onClick={onNext}>
          {busy ? 'Loading next location…' : 'Next round'}{' '}
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
  const rounds = session.results.length
  const difficultyLabel =
    DIFFICULTY_LEVELS.find((level) => level.id === session.difficulty)
      ?.label ?? session.difficulty
  if (rounds === 0) {
    return (
      <section className="sp-results sp-final" aria-label="Final results">
        <div className="sp-result-body">
          <span className="sp-eyebrow">WORLD EXPLORER · SESSION ENDED</span>
          <h1>No rounds played yet.</h1>
          <p>
            You ended this expedition before completing a round. Start a new
            one whenever you&apos;re ready — difficulty was set to{' '}
            <strong>{difficultyLabel}</strong>.
          </p>
        </div>
        <footer className="sp-result-actions">
          <Button className="sp-primary tg-control tg-control--primary" disabled={busy} onClick={onPlayAgain}>
            {busy ? 'Starting…' : 'Play again'} <span aria-hidden="true">↗</span>
          </Button>
          <Button
            variant="secondary"
            className="sp-secondary tg-control"
            disabled={busy}
            onClick={onHome}
          >
            Return home
          </Button>
        </footer>
      </section>
    )
  }
  const totalDistance = session.results.reduce(
    (sum, result) => sum + result.distanceKm,
    0,
  )
  const bestRound = session.results.reduce(
    (best, result) => Math.max(best, result.score),
    0,
  )
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
        <span className="sp-eyebrow">WORLD EXPLORER · SESSION SUMMARY</span>
        <h1>A world of discoveries.</h1>
        <div className="sp-earned">
          <strong>{session.totalScore.toLocaleString()}</strong>
          <span> total points</span>
        </div>
        <dl className="sp-summary-stats">
          <div>
            <dt>Rounds completed</dt>
            <dd>{rounds.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Average score / round</dt>
            <dd>{Math.round(session.totalScore / rounds).toLocaleString()} pts</dd>
          </div>
          <div>
            <dt>Best round</dt>
            <dd>{bestRound.toLocaleString()} pts</dd>
          </div>
          <div>
            <dt>Average distance</dt>
            <dd>{distanceLabel(totalDistance / rounds)}</dd>
          </div>
          <div>
            <dt>Difficulty</dt>
            <dd>{difficultyLabel}</dd>
          </div>
        </dl>
        <p aria-label="Total distance">
          Total distance: <strong>{distanceLabel(totalDistance)}</strong>
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
        <Button className="sp-primary tg-control tg-control--primary" disabled={busy} onClick={onPlayAgain}>
          {busy ? 'Starting…' : 'Play again'} <span aria-hidden="true">↗</span>
        </Button>
        <Button
          variant="secondary"
          className="sp-secondary tg-control"
          disabled={busy}
          onClick={onHome}
        >
          Return home
        </Button>
      </footer>
    </section>
  )
}
