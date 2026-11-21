import type { Difficulty, LobbyRules } from './contracts'

// Single source of truth for difficulty presentation and rules. The backend
// owns the authoritative rules (backend/src/domain/gameRules.ts); this mirrors
// them for the UI and for the Phase 1 mock service.

export interface DifficultyInfo {
  id: Difficulty
  label: string
  tagline: string
  description: string
  detail: string[]
  selection: string
  timeLimitSeconds: number
  attemptsPerRound: number
  selectionMode: 'list' | 'map'
  countryBorders: boolean
  extraData: { mode: 'free' } | { mode: 'points'; cost: number } | { mode: 'time'; cost: number }
}

export const DIFFICULTY_LEVELS: DifficultyInfo[] = [
  {
    id: 'easy',
    label: 'Easy',
    tagline: 'Relaxed exploring',
    description: 'Pick from a shortlist of six cities. Every clue is free — no pressure.',
    detail: ['7 min', '3 attempts', 'Free clues'],
    selection: 'Pick from a list',
    timeLimitSeconds: 7 * 60,
    attemptsPerRound: 3,
    selectionMode: 'list',
    countryBorders: true,
    extraData: { mode: 'free' },
  },
  {
    id: 'medium',
    label: 'Medium',
    tagline: 'A real challenge',
    description: 'Pin it on the world map with country borders. Weather clues cost points.',
    detail: ['4 min', '2 attempts', 'Clues cost 100 pts'],
    selection: 'World map',
    timeLimitSeconds: 4 * 60,
    attemptsPerRound: 2,
    selectionMode: 'map',
    countryBorders: true,
    extraData: { mode: 'points', cost: 100 },
  },
  {
    id: 'hard',
    label: 'Hard',
    tagline: 'For true explorers',
    description: 'One shot, tight clock. Unlock extra clues at the cost of seconds.',
    detail: ['2 min', '1 attempt', 'Clues cost 20 s'],
    selection: 'World map',
    timeLimitSeconds: 2 * 60,
    attemptsPerRound: 1,
    selectionMode: 'map',
    countryBorders: true,
    extraData: { mode: 'time', cost: 20 },
  },
]

export function difficultyInfo(difficulty: Difficulty): DifficultyInfo {
  return DIFFICULTY_LEVELS.find((level) => level.id === difficulty) ?? DIFFICULTY_LEVELS[1]
}

export function lobbyRules(difficulty: Difficulty): LobbyRules {
  const info = difficultyInfo(difficulty)
  return {
    timeLimitSeconds: info.timeLimitSeconds,
    attemptsPerRound: info.attemptsPerRound,
    selectionMode: info.selectionMode,
    countryBorders: info.countryBorders,
    extraData: info.extraData,
  }
}

export const DEFAULT_DIFFICULTY: Difficulty = 'medium'

export function readStoredDifficulty(): Difficulty {
  try {
    const saved = localStorage.getItem('terraguessr.difficulty.v1')
    return DIFFICULTY_LEVELS.some((level) => level.id === saved) ? (saved as Difficulty) : DEFAULT_DIFFICULTY
  } catch {
    return DEFAULT_DIFFICULTY
  }
}

export function storeDifficulty(difficulty: Difficulty): void {
  try {
    localStorage.setItem('terraguessr.difficulty.v1', difficulty)
  } catch {
    /* ignore */
  }
}
