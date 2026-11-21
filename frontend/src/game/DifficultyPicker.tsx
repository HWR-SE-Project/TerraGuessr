import './DifficultyPicker.css'
import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { DIFFICULTY_LEVELS } from './difficulty'
import type { Difficulty } from '../api/types'

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
  variant = 'singleplayer',
}: {
  value: Difficulty
  onChange: (difficulty: Difficulty) => void
  disabled?: boolean
  variant?: 'singleplayer' | 'lobby'
}) {
  const lobby = variant === 'lobby'
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
    const focusedIndex = optionRefs.current.findIndex(option => option === event.target)
    const index = focusedIndex < 0 ? currentIndex : focusedIndex
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        selectAt(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        selectAt(index - 1)
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
    <fieldset className={`tg-difficulty${lobby ? ' tg-difficulty--lobby' : ''}`} disabled={disabled}>
      <legend>{lobby ? 'Difficulty' : 'Choose your difficulty'}</legend>
      <div
        className="tg-difficulty-options"
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
              className="tg-difficulty-option tg-selection"
              onClick={() => onChange(level.id)}
            >
              {selected && (
                <span className="tg-difficulty-check" aria-hidden="true">
                  <CheckmarkIcon />
                </span>
              )}
              <span className="tg-difficulty-label">{level.label}</span>
              {lobby ? <>
                <span className="tg-difficulty-detail">{level.detail}</span>
                <span className="tg-difficulty-selection">{level.selection}</span>
              </> : <span className="tg-difficulty-description">{level.description}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
