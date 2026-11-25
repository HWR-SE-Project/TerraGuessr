import type { Difficulty, GameRules } from './contracts'

interface DifficultyInfo {
  id: Difficulty
  label: string
  tagline: string
  description: string
}

const selectionCopy = {
  list: 'Pick a marked city on the map',
  map: 'Drop a pin on the world map',
}

const clueCopy = {
  free: ' and explore with the extra clues unlocked.',
  points: ' and decide whether to spend points on clues.',
  time: '. Unlocking extra clues costs time.',
}

// Keep the card copy visible while the rules catalog loads.
const difficultyCards: Record<Difficulty, DifficultyInfo> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    tagline: 'Relaxed exploring',
    description: selectionCopy.list + clueCopy.free,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    tagline: 'A real challenge',
    description: selectionCopy.map + clueCopy.points,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    tagline: 'One shot',
    description: selectionCopy.map + clueCopy.time,
  },
}

export const DIFFICULTY_LEVELS: readonly DifficultyInfo[] = Object.values(difficultyCards)

export function difficultyInfo(difficulty: Difficulty, rules?: GameRules): DifficultyInfo {
  const card = difficultyCards[difficulty] ?? difficultyCards.medium
  if (!rules) return card
  return {
    ...card,
    tagline: card.id === 'hard' && rules.attemptsPerRound !== 1 ? 'For true explorers' : card.tagline,
    description: selectionCopy[rules.selectionMode] + clueCopy[rules.extraData.mode],
  }
}

export function difficultyDetails(rules: GameRules): string[] {
  const { timeLimitSeconds, attemptsPerRound, selectionMode, extraData } = rules
  const time = timeLimitSeconds % 60 === 0 ? `${timeLimitSeconds / 60} min` : `${timeLimitSeconds} s`
  const selection = selectionMode === 'list' ? '6 cities on the map' : 'World map'
  const cost = extraData.mode === 'free' ? 'Free clues' : `Clues cost ${extraData.cost} ${extraData.mode === 'points' ? 'pts' : 's'}`
  return [time, `${attemptsPerRound} ${attemptsPerRound === 1 ? 'attempt' : 'attempts'}`, selection, cost]
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
