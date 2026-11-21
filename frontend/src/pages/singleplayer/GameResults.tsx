import { Button } from '../../components/ui/Button'
import type { StreetResult, StreetSession } from '../../api/singleplayer'
import { GuessMap } from './GuessMap'
import { DIFFICULTY_LEVELS } from './difficulty'
import { coordinates, distanceLabel } from '../../lib/format'
import { ScoreBreakdown } from '../../components/ScoreBreakdown'
import { ResultCoords } from '../../components/ResultCoords'
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
        <p data-tutorial-distance>
          {result.guess
            ? <>You were <strong>{distanceLabel(result.distanceKm)}</strong> from the correct location.</>
            : 'You ran out of time before placing a guess.'}
        </p>
        <ScoreBreakdown
          score={result.score}
          extraDataPointsSpent={result.extraDataPointsSpent}
          tutorialAnchor
        />
        <ResultCoords actual={result.actual} guess={result.guess} />
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
  const difficultyLabel = DIFFICULTY_LEVELS.find(level => level.id === session.difficulty)?.label ?? session.difficulty
  const totalDistance = session.results.reduce((sum, result) => sum + (result.distanceKm ?? 0), 0)
  const bestRound = session.results.reduce<StreetResult | null>((best, result) =>
    !best || result.score > best.score ? result : best, null)
  return (
    <section className={`sp-session-summary sp-glass${rounds === 0 ? ' sp-session-empty' : ''}`} aria-label="Final results">
      <div className="sp-summary-intro">
        <span className="sp-summary-symbol" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="16" cy="16" r="12" /><path d="m20 12-2 6-6 2 2-6 6-2Z" /><path d="M16 1v3M16 28v3M1 16h3M28 16h3" /></svg></span>
        <h1>{rounds ? 'A world of discoveries.' : 'Adventure ended'}</h1>
        <p>{rounds
          ? `${rounds.toLocaleString()} ${rounds === 1 ? 'round explored' : 'rounds explored'}. Every journey brings a new perspective.`
          : 'No rounds completed this time. Ready for another journey?'}</p>
      </div>
      {rounds > 0 && <>
        <div className="sp-summary-score"><strong>{session.totalScore.toLocaleString()}</strong><span>total points</span></div>
        <dl className="sp-summary-stats">
          <div><dt>Rounds completed</dt><dd>{rounds.toLocaleString()}</dd></div>
          <div><dt>Average score / round</dt><dd>{Math.round(session.totalScore / rounds).toLocaleString()} pts</dd></div>
          <div><dt>Best round</dt><dd>{bestRound!.score.toLocaleString()} pts <small>Round {bestRound!.number}</small></dd></div>
          <div><dt>Average distance</dt><dd>{distanceLabel(totalDistance / rounds)}</dd></div>
          <div><dt>Difficulty</dt><dd>{difficultyLabel}</dd></div>
        </dl>
      </>}
      <footer className="tg-page-actions">
        <Button disabled={busy} onClick={onPlayAgain}>{busy ? 'Starting…' : 'Play Again'}</Button>
        <Button variant="secondary" disabled={busy} onClick={onHome}>Return Home</Button>
      </footer>
      {rounds > 0 && <details className="sp-summary-breakdown">
        <summary>Round breakdown <span>{rounds} {rounds === 1 ? 'round' : 'rounds'}</span></summary>
        <div className="sp-round-list">
          {session.results.map(result => <details key={result.roundId}>
            <summary><span>Round {result.number}</span><span>{distanceLabel(result.distanceKm)}</span><strong>{result.score.toLocaleString()} pts</strong></summary>
            <div><p>Correct location: {coordinates(result.actual)}</p><p>Your guess: {coordinates(result.guess)}</p></div>
          </details>)}
        </div>
      </details>}
    </section>
  )
}
