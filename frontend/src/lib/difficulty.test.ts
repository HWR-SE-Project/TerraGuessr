import { describe, expect, it } from 'vitest'
import { difficultyInfo, DIFFICULTY_LEVELS, lobbyRules } from './difficulty'

describe('difficulty rules', () => {
  it('exposes exactly the three difficulties', () => {
    expect(DIFFICULTY_LEVELS.map((level) => level.id)).toEqual(['easy', 'medium', 'hard'])
  })

  it('easy is list mode with free clues and 3 attempts', () => {
    const easy = difficultyInfo('easy')
    expect(easy.selectionMode).toBe('list')
    expect(easy.attemptsPerRound).toBe(3)
    expect(easy.extraData.mode).toBe('free')
  })

  it('medium is map mode with point-cost clues', () => {
    const medium = difficultyInfo('medium')
    expect(medium.selectionMode).toBe('map')
    expect(medium.attemptsPerRound).toBe(2)
    expect(medium.extraData).toEqual({ mode: 'points', cost: 100 })
  })

  it('hard is map mode with time-cost clues and one attempt', () => {
    const hard = difficultyInfo('hard')
    expect(hard.selectionMode).toBe('map')
    expect(hard.attemptsPerRound).toBe(1)
    expect(hard.extraData).toEqual({ mode: 'time', cost: 20 })
  })

  it('derives lobby rules from difficulty', () => {
    expect(lobbyRules('medium')).toMatchObject({
      timeLimitSeconds: 4 * 60,
      attemptsPerRound: 2,
      selectionMode: 'map',
      countryBorders: true,
    })
  })
})
