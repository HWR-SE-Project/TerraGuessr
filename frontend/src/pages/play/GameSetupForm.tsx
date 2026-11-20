import { useState } from 'react'
import type {
  CreateGameInput,
  Difficulty,
  SelectionMode,
} from '../../api/types'
import './PlayPage.css'

export interface GameSetupFormProps {
  onStart: (input: CreateGameInput & { selectionMode: SelectionMode }) => void
  submitting: boolean
  error: string | null
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const ROUNDS_OPTIONS = [3, 5, 10]

export function GameSetupForm({
  onStart,
  submitting,
  error,
}: GameSetupFormProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('map')
  const [roundsTotal, setRoundsTotal] = useState(5)

  function chooseDifficulty(next: Difficulty) {
    setDifficulty(next)
    if (next === 'easy') setSelectionMode('list')
    if (next === 'hard') setSelectionMode('map')
  }

  return (
    <div className="tg-play-setup">
      <div className="tg-play-eyebrow">Solo expedition</div>
      <h1 className="tg-play-title">Play TerraGuessr</h1>
      <p className="tg-play-subtitle">
        You'll see live weather for a mystery location — no map imagery. Guess
        where it is.
      </p>

      <div className="tg-play-field">
        <span className="tg-play-field-label">Difficulty</span>
        <div className="tg-play-choice-row">
          {DIFFICULTIES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`tg-play-choice tg-control${difficulty === option.value ? ' tg-play-choice--active' : ''}`}
              aria-pressed={difficulty === option.value}
              onClick={() => chooseDifficulty(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tg-play-field">
        <span className="tg-play-field-label">How you'll guess</span>
        <div className="tg-play-choice-row">
          <button
            type="button"
            className={`tg-play-choice tg-control${selectionMode === 'map' ? ' tg-play-choice--active' : ''}`}
            disabled={difficulty === 'easy'}
            aria-pressed={selectionMode === 'map'}
            onClick={() => setSelectionMode('map')}
          >
            Click the map
          </button>
          <button
            type="button"
            className={`tg-play-choice tg-control${selectionMode === 'list' ? ' tg-play-choice--active' : ''}`}
            disabled={difficulty === 'hard'}
            aria-pressed={selectionMode === 'list'}
            onClick={() => setSelectionMode('list')}
          >
            Pick from a list
          </button>
        </div>
      </div>

      <p className="tg-play-mode-hint">
        {difficulty === 'easy'
          ? 'Easy gives you regions to choose from.'
          : difficulty === 'hard'
            ? 'Hard puts your instincts to the test on the map.'
            : 'Medium lets you choose how to find your place.'}
      </p>
      <div className="tg-play-field">
        <span className="tg-play-field-label">Rounds</span>
        <div className="tg-play-choice-row">
          {ROUNDS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`tg-play-choice tg-control${roundsTotal === option ? ' tg-play-choice--active' : ''}`}
              aria-pressed={roundsTotal === option}
              onClick={() => setRoundsTotal(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="tg-play-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="tg-play-cta tg-control tg-control--primary"
        disabled={submitting}
        onClick={() =>
          onStart({
            mode: 'solo',
            difficulty,
            roundsTotal,
            selectionMode,
            candidateCount: selectionMode === 'list' ? 4 : undefined,
          })
        }
      >
        {submitting ? 'Starting…' : 'Start playing'}
      </button>
    </div>
  )
}
