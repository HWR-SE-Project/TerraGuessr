import type { Difficulty } from '../../api/singleplayer'

export type { Difficulty }

const STORAGE_KEY = 'terraguessr.difficulty.v1'
export const DEFAULT_DIFFICULTY: Difficulty = 'medium'
const VALID: readonly Difficulty[] = ['easy', 'medium', 'hard']

export function readDifficulty(): Difficulty {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return (VALID as readonly string[]).includes(saved ?? '')
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
}

export const DIFFICULTY_LEVELS: readonly DifficultyInfo[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: '7 min · 3 attempts · choose from 6 locations.',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: '4 min · 2 attempts · world map with country borders · clues cost 100 points.',
  },
  {
    id: 'hard',
    label: 'Hard',
    description: '2 min · 1 attempt · unlock clues for 20 seconds.',
  },
]
