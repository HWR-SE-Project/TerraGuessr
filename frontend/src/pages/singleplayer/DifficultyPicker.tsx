import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { DIFFICULTY_LEVELS } from './difficulty'
import type { Difficulty } from './difficulty'

function CheckmarkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 5 5 9-10" />
    </svg>
  )
}

export function DifficultyPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Difficulty
  onChange: (difficulty: Difficulty) => void
  disabled?: boolean
}) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const currentIndex = DIFFICULTY_LEVELS.findIndex((level) => level.id === value)

  function selectAt(index: number) {
    const wrapped = (index + DIFFICULTY_LEVELS.length) % DIFFICULTY_LEVELS.length
    onChange(DIFFICULTY_LEVELS[wrapped].id)
    optionRefs.current[wrapped]?.focus()
  }

  // Standard ARIA radiogroup pattern: arrow keys move focus *and* selection
  // together (roving tabindex below), matching native <input type="radio">.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        selectAt(currentIndex + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        selectAt(currentIndex - 1)
        break
      case 'Home':
        event.preventDefault()
        selectAt(0)
        break
      case 'End':
        event.preventDefault()
        selectAt(DIFFICULTY_LEVELS.length - 1)
        break
    }
  }

  return (
    <fieldset className="sp-difficulty" disabled={disabled}>
      <legend>Difficulty</legend>
      <div
        className="sp-difficulty-options"
        role="radiogroup"
        aria-label="Difficulty"
        onKeyDown={onKeyDown}
      >
        {DIFFICULTY_LEVELS.map((level, index) => {
          const selected = value === level.id
          return (
            <button
              key={level.id}
              ref={(element) => {
                optionRefs.current[index] = element
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={`sp-difficulty-option tg-control${selected ? ' sp-difficulty-option--selected' : ''}`}
              onClick={() => onChange(level.id)}
            >
              {selected && (
                <span className="sp-difficulty-check" aria-hidden="true">
                  <CheckmarkIcon />
                </span>
              )}
              <span className="sp-difficulty-label">{level.label}</span>
              <span className="sp-difficulty-tagline">{level.tagline}</span>
              <span className="sp-difficulty-description">{level.description}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
