import { describe, expect, it } from 'vitest'
import { DIFFICULTY_LEVELS, difficultyDetails, difficultyInfo } from './difficulty'
import { mockGameRules } from '../services/mock/gameRules'

describe('difficulty presentation', () => {
  it('offers the three difficulties in order', () => {
    expect(DIFFICULTY_LEVELS.map((level) => level.id)).toEqual(['easy', 'medium', 'hard'])
  })

  it('formats the supplied rules for the picker and help page', () => {
    expect(difficultyDetails(mockGameRules('easy'))).toEqual(['7 min', '3 attempts', 'Pick from a city list', 'Free clues'])
    expect(difficultyDetails(mockGameRules('medium'))).toEqual(['4 min', '2 attempts', 'World map', 'Clues cost 100 pts'])
    expect(difficultyDetails(mockGameRules('hard'))).toEqual(['2 min', '1 attempt', 'World map', 'Clues cost 20 s'])
  })

  it('uses the API values even if they differ from the defaults', () => {
    const rules = { ...mockGameRules('medium'), timeLimitSeconds: 95, attemptsPerRound: 4 }
    expect(difficultyDetails(rules).slice(0, 2)).toEqual(['95 s', '4 attempts'])
  })

  it('preserves the existing descriptions and taglines when the current rules load', () => {
    for (const { id } of DIFFICULTY_LEVELS) {
      expect(difficultyInfo(id, mockGameRules(id))).toEqual(difficultyInfo(id))
    }
    expect(difficultyInfo('easy').description).toBe('Pick a city and explore with the extra clues unlocked.')
    expect(difficultyInfo('medium').description).toBe('Drop a pin on the world map and decide whether to spend points on clues.')
    expect(difficultyInfo('hard').description).toBe('Drop a pin on the world map. Unlocking extra clues costs time.')
    expect(difficultyInfo('hard').tagline).toBe('One shot')
  })

  it('describes the selection, clue policy, and attempts from the supplied rules', () => {
    const rules = {
      ...mockGameRules('hard'),
      selectionMode: 'list',
      extraData: { mode: 'points', cost: 30 },
      attemptsPerRound: 2,
    } as const

    expect(difficultyInfo('hard', rules)).toMatchObject({
      label: 'Hard',
      tagline: 'For true explorers',
      description: 'Pick a city and decide whether to spend points on clues.',
    })
  })
})
