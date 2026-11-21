import { motion } from 'framer-motion'
import type { StreetResult } from '../api/singleplayer'
import { coordinates, distanceLabel } from '../lib/format'
import { duration, ease, stagger } from '../lib/motion'

type Result = Pick<StreetResult, 'score' | 'guess' | 'actual' | 'distanceKm' | 'extraDataPointsSpent'>

// A Fragment stays the root here (not a wrapping motion.div) so these stay
// direct children of `.sp-result-body` — Game.css relies on that (e.g.
// `.sp-result-body > p`, `.sp-final .sp-result-body > *`). Each line reveals
// in a light, manual stagger instead via an incrementing transition delay.
const reveal = (step: number) => ({ duration: duration.base, ease: ease.out, delay: step * stagger.base })
const hidden = { opacity: 0, y: 10 }
const shown = { opacity: 1, y: 0 }

/** The score, distance and coordinates have identical meaning in both game modes. */
export function RoundResultDetails({ result, tutorialAnchor = false }: { result: Result; tutorialAnchor?: boolean }) {
  const { score, guess, actual, distanceKm, extraDataPointsSpent = 0 } = result
  return <>
    <motion.h1 initial={hidden} animate={shown} transition={reveal(0)}>
      {score >= 4500 ? 'Incredible instinct.' : score >= 2500 ? 'Nicely explored.' : 'Every guess is a discovery.'}
    </motion.h1>
    <motion.p initial={hidden} animate={shown} transition={reveal(1)} data-tutorial-distance={tutorialAnchor || undefined}>
      {guess ? <>You were <strong>{distanceLabel(distanceKm)}</strong> from the correct location.</> : 'You ran out of time before placing a guess.'}
    </motion.p>
    <motion.div className="sp-earned" initial={hidden} animate={shown} transition={reveal(2)} data-tutorial-points={tutorialAnchor || undefined}>
      <strong>{score.toLocaleString()}</strong><span> / 5,000 points</span>
    </motion.div>
    <motion.div className="sp-score-track" initial={hidden} animate={shown} transition={reveal(3)}>
      <span style={{ width: `${score / 50}%` }} />
    </motion.div>
    {extraDataPointsSpent > 0 && (
      <motion.p className="sp-result-extra" initial={hidden} animate={shown} transition={reveal(4)}>
        Additional data: −{extraDataPointsSpent} points
      </motion.p>
    )}
    <motion.div className="sp-result-coords" initial={hidden} animate={shown} transition={reveal(extraDataPointsSpent > 0 ? 5 : 4)}>
      <span>Correct location<strong>{coordinates(actual)}</strong></span>
      <span>Your guess<strong>{coordinates(guess)}</strong></span>
    </motion.div>
  </>
}
