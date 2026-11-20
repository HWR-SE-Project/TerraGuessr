import { DIFFICULTY_LEVELS } from './difficulty'
import type { Difficulty } from './difficulty'

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
    <fieldset className="sp-difficulty" disabled={disabled}>
      <legend>Difficulty</legend>
      <div className="sp-difficulty-options" role="radiogroup" aria-label="Difficulty">
        {DIFFICULTY_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            role="radio"
            aria-checked={value === level.id}
            className={`sp-difficulty-option tg-control${value === level.id ? ' sp-difficulty-option--selected' : ''}`}
            onClick={() => onChange(level.id)}
          >
            <span className="sp-difficulty-label">{level.label}</span>
            <span className="sp-difficulty-tagline">{level.tagline}</span>
            <span className="sp-difficulty-description">{level.description}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
