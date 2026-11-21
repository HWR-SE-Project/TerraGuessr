import { describe, expect, it } from 'vitest'
import { MAX_SCORE, scoreForDistance } from './scoring'

describe('scoreForDistance (frontend parity)', () => {
  it('awards the maximum score for a perfect guess (0 km -> 5000)', () => {
    expect(scoreForDistance(0)).toBe(5000)
  })

  it('awards the maximum score for any distance up to 100 km', () => {
    expect(scoreForDistance(100)).toBe(5000)
    expect(scoreForDistance(50)).toBe(5000)
  })

  it('applies the R10 boundary on the R9-rounded distance', () => {
    expect(scoreForDistance(100.04)).toBe(5000)
    expect(scoreForDistance(100.05)).toBeLessThan(5000)
  })

  it('decays linearly between the boundaries', () => {
    expect(scoreForDistance(2000)).toBe(4522)
    expect(scoreForDistance(10000)).toBe(2512)
  })

  it('awards 0 points at and beyond 20000 km', () => {
    expect(scoreForDistance(20000)).toBe(0)
    expect(scoreForDistance(20015)).toBe(0)
  })

  it('returns 0 for NaN', () => {
    expect(scoreForDistance(Number.NaN)).toBe(0)
  })

  it('exposes 5000 as the maximum score', () => {
    expect(MAX_SCORE).toBe(5000)
  })
})
