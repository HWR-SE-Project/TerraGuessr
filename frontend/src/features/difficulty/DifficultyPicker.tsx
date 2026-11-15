import { useId, useState } from 'react';
import type { Difficulty, SelectionMode } from '../../api/types';

/** What the picker emits: the chosen difficulty plus the selection mode it allows. */
export interface DifficultySelection {
  difficulty: Difficulty;
  selectionMode: SelectionMode;
}

export const DEFAULT_DIFFICULTY: Difficulty = 'easy';
/**
 * Medium starts in map mode (the primary guessing surface) and the player may
 * switch to list mode. Easy/Hard never use this default: their mode is forced.
 */
export const DEFAULT_MEDIUM_SELECTION_MODE: SelectionMode = 'map';

export interface DifficultyOption {
  value: Difficulty;
  label: string;
  description: string;
}

export const DIFFICULTY_OPTIONS: ReadonlyArray<DifficultyOption> = [
  { value: 'easy', label: 'Easy', description: 'Pick from a list of candidates.' },
  { value: 'medium', label: 'Medium', description: 'Switch between map and list.' },
  { value: 'hard', label: 'Hard', description: 'Place your guess on the map.' },
];

/**
 * R05 — Easy is list-only, Hard is map-only, Medium accepts either mode.
 * Any mode supplied for a forced difficulty is discarded so callers can never
 * emit an illegal pair (e.g. easy/map).
 */
export function normalizeSelection(
  difficulty: Difficulty,
  selectionMode: SelectionMode = DEFAULT_MEDIUM_SELECTION_MODE,
): DifficultySelection {
  switch (difficulty) {
    case 'easy':
      return { difficulty, selectionMode: 'list' };
    case 'hard':
      return { difficulty, selectionMode: 'map' };
    case 'medium':
      return {
        difficulty,
        selectionMode: selectionMode === 'list' ? 'list' : 'map',
      };
  }
}

export function defaultSelection(
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
  selectionMode: SelectionMode = DEFAULT_MEDIUM_SELECTION_MODE,
): DifficultySelection {
  return normalizeSelection(difficulty, selectionMode);
}

export interface DifficultyPickerProps {
  /** Controlled value. Omit to let the picker manage its own state. */
  value?: DifficultySelection;
  /** Initial value when uncontrolled. Defaults to Easy + list. */
  defaultValue?: DifficultySelection;
  /** Emits a normalized {difficulty, selectionMode} pair on every change. */
  onChange: (selection: DifficultySelection) => void;
  disabled?: boolean;
  legend?: string;
}

/**
 * Difficulty UI (R05, M3). Accessible radio group for Easy/Medium/Hard plus a
 * map/list toggle that only exists for Medium. Every emission is normalized,
 * so Easy always emits `list` and Hard always emits `map`.
 */
export function DifficultyPicker({
  value,
  defaultValue,
  onChange,
  disabled = false,
  legend = 'Difficulty',
}: DifficultyPickerProps) {
  const idPrefix = useId();
  const hintId = useId();
  const [internalSelection, setInternalSelection] = useState<DifficultySelection>(() =>
    defaultSelection(
      defaultValue?.difficulty ?? DEFAULT_DIFFICULTY,
      defaultValue?.selectionMode ?? DEFAULT_MEDIUM_SELECTION_MODE,
    ),
  );

  const selection = value
    ? normalizeSelection(value.difficulty, value.selectionMode)
    : internalSelection;
  const isMedium = selection.difficulty === 'medium';

  function commit(next: DifficultySelection) {
    if (value === undefined) {
      setInternalSelection(next);
    }
    onChange(next);
  }

  function handleDifficultyChange(difficulty: Difficulty) {
    // Remember the current mode when it is legal for the new difficulty;
    // otherwise fall back to the difficulty's forced/default mode.
    const nextMode = isMedium ? selection.selectionMode : DEFAULT_MEDIUM_SELECTION_MODE;
    commit(normalizeSelection(difficulty, nextMode));
  }

  function handleModeChange(mode: SelectionMode) {
    if (!isMedium) {
      return;
    }
    commit({ difficulty: 'medium', selectionMode: mode });
  }

  return (
    <fieldset
      data-testid="difficulty-picker"
      aria-describedby={isMedium ? undefined : hintId}
      disabled={disabled}
      className="tg-difficulty-picker"
      style={{ border: 'none', margin: 0, padding: 0 }}
    >
      <legend style={{ marginBottom: '12px', fontWeight: 800, fontSize: 14 }}>{legend}</legend>

      <div role="radiogroup" aria-label={legend} style={{ display: 'flex', gap: '0.5rem' }}>
        {DIFFICULTY_OPTIONS.map((option) => {
          const selected = option.value === selection.difficulty;
          return (
            <label
              key={option.value}
              data-testid={`difficulty-option-${option.value}`}
              className={`tg-difficulty-card${selected ? ' is-selected' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.125rem',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--tg-line)',
                borderRadius: '14px',
                background: selected ? 'rgb(112 224 192 / 9%)' : 'var(--tg-surface)',
                color: 'var(--tg-text)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: selected ? 700 : 400,
                outline: selected ? '1px solid var(--tg-mint)' : undefined,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <input
                  type="radio"
                  name={`${idPrefix}-difficulty`}
                  value={option.value}
                  checked={selected}
                  data-testid={`difficulty-${option.value}`}
                  onChange={() => handleDifficultyChange(option.value)}
                />
                <span>{option.label}</span>
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--tg-muted)', lineHeight: 1.4 }}>{option.description}</span>
            </label>
          );
        })}
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        {isMedium ? (
          <div
            data-testid="mode-toggle"
            role="group"
            aria-label="Selection mode"
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <span>Selection mode:</span>
            <button
              type="button"
              data-testid="mode-option-map"
              aria-pressed={selection.selectionMode === 'map'}
              onClick={() => handleModeChange('map')}
              style={{ fontWeight: selection.selectionMode === 'map' ? 700 : 400 }}
            >
              Map
            </button>
            <button
              type="button"
              data-testid="mode-option-list"
              aria-pressed={selection.selectionMode === 'list'}
              onClick={() => handleModeChange('list')}
              style={{ fontWeight: selection.selectionMode === 'list' ? 700 : 400 }}
            >
              List
            </button>
          </div>
        ) : (
          <p id={hintId} data-testid="selection-mode-locked" style={{ margin: 0 }}>
            {selection.difficulty === 'easy'
              ? 'Easy uses list selection only.'
              : 'Hard uses map selection only.'}
          </p>
        )}
      </div>
    </fieldset>
  );
}

export default DifficultyPicker;
