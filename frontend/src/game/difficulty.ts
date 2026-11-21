import type { Difficulty } from '../api/types'

const STORAGE_KEY = 'terraguessr.difficulty.v1'
export const DEFAULT_DIFFICULTY: Difficulty = 'medium'

export function readDifficulty(): Difficulty {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return DIFFICULTY_LEVELS.some(level => level.id === saved)
      ? (saved as Difficulty)
      : DEFAULT_DIFFICULTY
  } catch {
    return DEFAULT_DIFFICULTY
  }
}

export function saveDifficulty(difficulty: Difficulty): void {
  try {
    localStorage.setItem(STORAGE_KEY, difficulty)
  } catch {
    /* Choice remains available in memory for this session. */
  }
}

export interface DifficultyInfo {
  id: Difficulty
  label: string
  description: string
  detail: string
  selection: string
}

export const DIFFICULTY_LEVELS: readonly DifficultyInfo[] = [
  {
    id: 'easy',
    label: 'Easy',
    detail: '7 min · 3 attempts · free clues',
    selection: 'Pick from a list',
    description: '7 min · 3 attempts · choose from 6 locations.',
  },
  {
    id: 'medium',
    label: 'Medium',
    detail: '4 min · 2 attempts · clues cost 100 pts',
    selection: 'World map',
    description: '4 min · 2 attempts · world map with country borders · clues cost 100 points.',
  },
  {
    id: 'hard',
    label: 'Hard',
    detail: '2 min · 1 attempt · clues cost 20 s',
    selection: 'World map',
    description: '2 min · 1 attempt · unlock clues for 20 seconds.',
  },
]
