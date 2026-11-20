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
  tagline: string
  description: string
}

export const DIFFICULTY_LEVELS: readonly DifficultyInfo[] = [
  {
    id: 'easy',
    label: 'Easy',
    tagline: 'Pick from a shortlist',
    description:
      'Choose your guess from a handful of named cities instead of the open map. Geographic intelligence starts open.',
  },
  {
    id: 'medium',
    label: 'Medium',
    tagline: 'Free placement',
    description:
      'Drop your pin anywhere on the world map. Geographic intelligence starts open.',
  },
  {
    id: 'hard',
    label: 'Hard',
    tagline: 'No hand-holding',
    description:
      'Drop your pin anywhere on the world map. Geographic intelligence starts collapsed — open it yourself if you want the clues.',
  },
]
