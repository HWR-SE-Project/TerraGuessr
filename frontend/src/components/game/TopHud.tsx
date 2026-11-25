import { motion } from 'framer-motion'
import { IconButton } from '../ui/Button'
import { formatScore } from '../../lib/format'

/** Compact round/score/attempts bar used across singleplayer and multiplayer. */
export function TopHud({
  round,
  roundsTotal,
  score,
  attemptsUsed,
  attemptsTotal,
  timer,
  onMenu,
}: {
  round: number
  roundsTotal?: number
  score: number
  attemptsUsed?: number
  attemptsTotal?: number
  timer?: React.ReactNode
  onMenu?: () => void
}) {
  const attempts = attemptsTotal != null ? Array.from({ length: attemptsTotal }, (_, i) => i < (attemptsUsed ?? 0)) : null
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none flex shrink-0 items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="surface-flat flex items-center gap-2 px-3 py-2 shadow-card">
          <span className="font-display text-sm font-semibold text-cream">
            Round {round}
            {roundsTotal ? <span className="text-subtle"> / {roundsTotal}</span> : null}
          </span>
          <motion.span
            key={score}
            initial={{ scale: 1.12 }}
            animate={{ scale: 1 }}
            className="rounded-full bg-lime-400 px-2.5 py-0.5 font-display text-sm font-semibold text-ink"
          >
            {formatScore(score)}
          </motion.span>
          {attempts && (
            <span className="flex items-center gap-1" aria-label={`${attemptsUsed} of ${attemptsTotal} attempts used`}>
              {attempts.map((used, i) => (
                <span
                  key={i}
                  className={`size-2 rounded-full ${used ? 'bg-lime-400' : 'bg-white/20'}`}
                />
              ))}
            </span>
          )}
        </div>
        {timer}
      </div>
      {onMenu && (
        <div className="pointer-events-auto">
          <IconButton
            name="menu"
            label="Game menu"
            onClick={onMenu}
            variant="solid"
            className="border-white/8 bg-space-700 shadow-card hover:bg-space-600"
          />
        </div>
      )}
    </motion.div>
  )
}

/** Floating "menu" affordance when no explicit onMenu is wired (placeholder). */
export function MenuDots({ onClick }: { onClick: () => void }) {
  return (
    <IconButton
      name="menu"
      label="Game menu"
      onClick={onClick}
      variant="solid"
      className="border-white/8 bg-space-700 shadow-card hover:bg-space-600"
    />
  )
}
