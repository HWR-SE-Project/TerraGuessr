import { Button } from '../../components/ui/Button'
import type { StreetResult, StreetSession } from '../../api/singleplayer'
import { GuessMap } from '../../game/GuessMap'
import { DIFFICULTY_LEVELS } from '../../game/difficulty'
import { coordinates, distanceLabel } from '../../lib/format'
import { RoundResultDetails } from '../../game/RoundResultDetails'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { celebrateVariants, duration, ease, staggerContainer, staggerItem } from '../../lib/motion'

// Subtler than the route-level `pageVariants` — these are in-page phase
// swaps, not full navigations. Score as "excellent" using the same 4,500pt
// threshold RoundResultDetails already uses for "Incredible instinct.".
const sectionVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, y: -8, transition: { duration: duration.fast, ease: ease.out } },
}
const EXCELLENT_SCORE = 4500
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
    <motion.section
      className="sp-results"
      aria-label="Round results"
      variants={sectionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="sp-result-map">
        <GuessMap key={result.roundId} results={[result]} interactive={false} />
        <Legend />
      </div>
      <div className="sp-result-body">
        <span className="sp-eyebrow">ROUND {result.number} COMPLETE</span>
        <RoundResultDetails result={result} tutorialAnchor />
      </div>
      <footer className="sp-result-actions">
        <Button disabled={busy} onClick={onNext}>
          {busy ? 'Loading next location…' : 'Next round'}{' '}
          <span aria-hidden="true">→</span>
        </Button>
      </footer>
    </motion.section>
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
  const excellentRun = rounds > 0 && bestRound !== null && bestRound.score >= EXCELLENT_SCORE
  return (
    <motion.section
      className={`sp-session-summary tg-glass${rounds === 0 ? ' sp-session-empty' : ''}`}
      aria-label="Final results"
      variants={sectionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="sp-summary-intro">
        <span className="sp-summary-symbol" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="16" cy="16" r="12" /><path d="m20 12-2 6-6 2 2-6 6-2Z" /><path d="M16 1v3M16 28v3M1 16h3M28 16h3" /></svg></span>
        <h1>{rounds ? 'A world of discoveries.' : 'Adventure ended'}</h1>
        <p>{rounds
          ? `${rounds.toLocaleString()} ${rounds === 1 ? 'round explored' : 'rounds explored'}. Every journey brings a new perspective.`
          : 'No rounds completed this time. Ready for another journey?'}</p>
      </div>
      {rounds > 0 && <>
        <motion.div
          className="sp-summary-score"
          variants={excellentRun ? celebrateVariants : staggerItem}
          initial="initial"
          animate="animate"
        >
          <strong>{session.totalScore.toLocaleString()}</strong><span>total points</span>
        </motion.div>
        <motion.dl className="sp-summary-stats" variants={staggerContainer} initial="initial" animate="animate">
          <motion.div variants={staggerItem}><dt>Rounds completed</dt><dd>{rounds.toLocaleString()}</dd></motion.div>
          <motion.div variants={staggerItem}><dt>Average score / round</dt><dd>{Math.round(session.totalScore / rounds).toLocaleString()} pts</dd></motion.div>
          <motion.div variants={excellentRun ? celebrateVariants : staggerItem}><dt>Best round</dt><dd>{bestRound!.score.toLocaleString()} pts <small>Round {bestRound!.number}</small></dd></motion.div>
          <motion.div variants={staggerItem}><dt>Average distance</dt><dd>{distanceLabel(totalDistance / rounds)}</dd></motion.div>
          <motion.div variants={staggerItem}><dt>Difficulty</dt><dd>{difficultyLabel}</dd></motion.div>
        </motion.dl>
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
    </motion.section>
  )
}
