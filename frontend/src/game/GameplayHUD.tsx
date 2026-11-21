import { motion } from 'framer-motion'
import { duration, ease, spring } from '../lib/motion'

export function GameplayHUD({
  round,
  roundsTotal,
  score,
  status,
}: {
  round: number
  roundsTotal?: number
  score: number
  status: string
}) {
  return (
    <motion.div
      className="sp-hud"
      role="status"
      aria-label="Game progress"
      aria-atomic="true"
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: duration.base, ease: ease.out }}
    >
      <span className="sp-hud-round">
        Round {round}
        {roundsTotal !== undefined && <span className="sp-hud-sr-only"> of {roundsTotal}</span>}
      </span>
      <strong className="sp-hud-score">
        <span className="sp-hud-sr-only">Total score: </span>
        <motion.span
          key={score}
          className="sp-hud-score-value"
          initial={{ opacity: 0.4, scale: 0.92, y: 2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={spring.snappy}
          style={{ display: 'inline-block' }}
        >
          {score.toLocaleString()}
        </motion.span>{' '}
        <span className="sp-hud-unit">pts</span>
      </strong>
      <span className="sp-hud-sr-only">{status}</span>
    </motion.div>
  )
}
