import { describe, expect, it } from 'vitest'
import type { LobbyMatchResult } from '../../api/types'
import { asStreetResults } from './matchAdapters'

const actual = { lat: 51.5, lon: -0.12 }

function result(overrides: Partial<LobbyMatchResult> = {}): LobbyMatchResult {
  return {
    roundNumber: 1,
    score: 0,
    distanceKm: null,
    guess: null,
    actual,
    attemptsUsed: 0,
    guesses: [],
    ...overrides,
  }
}

describe('asStreetResults (R11 actual-location reveal)', () => {
  it('keeps a timeout result without a submitted guess so the actual marker still renders', () => {
    const adapted = asStreetResults([result()])
    expect(adapted).toHaveLength(1)
    expect(adapted[0]).toMatchObject({
      number: 1,
      guess: null,
      distanceKm: null,
      actual,
      score: 0,
    })
  })

  it('preserves a submitted guess and its distance', () => {
    const guess = { lat: 48.85, lon: 2.35 }
    const adapted = asStreetResults([
      result({ roundNumber: 2, guess, distanceKm: 343.6, score: 1234 }),
    ])
    expect(adapted[0]).toMatchObject({
      number: 2,
      guess,
      distanceKm: 343.6,
      actual,
      score: 1234,
    })
  })
})
