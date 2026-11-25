import { motion } from 'framer-motion'
import type { Difficulty, GameRules } from '../../lib/contracts'
import { DIFFICULTY_LEVELS, difficultyDetails, difficultyInfo } from '../../lib/difficulty'
import { Icon } from '../ui/Icon'

export function DifficultyPicker({
  value,
  onChange,
  rules,
  disabled = false,
}: {
  value: Difficulty
  onChange: (difficulty: Difficulty) => void
  rules?: Record<Difficulty, GameRules>
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Difficulty" className="grid gap-3 sm:grid-cols-3">
      {DIFFICULTY_LEVELS.map(({ id }) => {
        const level = difficultyInfo(id, rules?.[id])
        const selected = value === level.id
        return (
          <motion.button
            key={level.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(level.id)}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            className={`relative flex flex-col gap-2 rounded-3xl border p-5 text-left transition-colors ${
              selected
                ? 'border-lime-400/70 bg-lime-400/12'
                : 'border-white/10 bg-space-700 hover:border-white/20'
            }`}
          >
            {selected && (
              <motion.span
                layoutId="difficulty-check"
                className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-lime-400 text-ink"
                transition={{ type: 'spring', stiffness: 520, damping: 32 }}
              >
                <Icon name="check" size={14} />
              </motion.span>
            )}
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold text-cream">{level.label}</span>
              <span className="text-xs font-bold text-subtle">{level.tagline}</span>
            </div>
            <p className="text-sm leading-relaxed text-muted">{level.description}</p>
            {rules && <div className="mt-auto flex flex-wrap gap-1.5">
              {difficultyDetails(rules[level.id]).map((detail) => (
                <span key={detail} className="rounded-full bg-space-600 px-2.5 py-1 text-xs font-bold text-cream/80">
                  {detail}
                </span>
              ))}
            </div>}
          </motion.button>
        )
      })}
    </div>
  )
}

export function DifficultySummary({
  difficulty,
  rules,
  className = 'bg-space-700',
}: {
  difficulty: Difficulty
  rules?: GameRules
  className?: string
}) {
  const info = difficultyInfo(difficulty, rules)
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-4 ${className}`}>
      <Icon name="info" size={20} className="shrink-0 text-sky-300" />
      <p className="text-sm text-muted">{info.description}</p>
    </div>
  )
}
