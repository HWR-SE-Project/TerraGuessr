import { motion } from 'framer-motion'
import type { Difficulty } from '../../lib/contracts'
import { DIFFICULTY_LEVELS } from '../../lib/difficulty'
import { Icon } from '../ui/Icon'

export function DifficultyPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Difficulty
  onChange: (difficulty: Difficulty) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Difficulty" className="grid gap-3 sm:grid-cols-3">
      {DIFFICULTY_LEVELS.map((level) => {
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
            <div className="mt-auto flex flex-wrap gap-1.5">
              {level.detail.map((detail) => (
                <span key={detail} className="rounded-full bg-space-600 px-2.5 py-1 text-xs font-bold text-cream/80">
                  {detail}
                </span>
              ))}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
