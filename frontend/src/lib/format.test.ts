import { describe, expect, it } from 'vitest'
import { formatDistance, formatScore } from './format'
import { haversineKm, scoreForDistance } from '../services/mock/gameRules'

describe('scoreForDistance (mirrors backend scoring curve)', () => {
  it('awards the max score under 100 km', () => {
    expect(scoreForDistance(0)).toBe(5000)
    expect(scoreForDistance(99.9)).toBe(5000)
    expect(scoreForDistance(100)).toBe(5000)
  })

  it('decays linearly between 100 and 20000 km', () => {
    const near = scoreForDistance(1000)
    const far = scoreForDistance(15000)
    expect(near).toBeGreaterThan(far)
    expect(near).toBeLessThan(5000)
    expect(far).toBeGreaterThan(0)
  })

  it('returns zero at or beyond 20000 km', () => {
    expect(scoreForDistance(20000)).toBe(0)
    expect(scoreForDistance(20000)).toBe(0)
    expect(scoreForDistance(50000)).toBe(0)
  })

  it('handles null and non-finite distances', () => {
    expect(scoreForDistance(null)).toBe(0)
    expect(scoreForDistance(Number.NaN)).toBe(0)
  })
})

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: 10, lon: 20 }, { lat: 10, lon: 20 })).toBe(0)
  })

  it('returns a plausible distance for a known pair', () => {
    // Paris → London is roughly 340 km.
    const distance = haversineKm({ lat: 48.8584, lon: 2.2945 }, { lat: 51.5007, lon: -0.1246 })
    expect(distance).toBeGreaterThan(300)
    expect(distance).toBeLessThan(380)
  })
})

describe('format helpers', () => {
  it('formats distances in kilometers rounded to one decimal place', () => {
    expect(formatDistance(null)).toBe('—')
    expect(formatDistance(Number.NaN)).toBe('—')
    expect(formatDistance(0)).toBe('0.0 km')
    expect(formatDistance(0.45)).toBe('0.5 km')
    expect(formatDistance(100.04)).toBe('100.0 km')
    expect(formatDistance(100.05)).toBe('100.1 km')
    expect(formatDistance(340)).toBe('340.0 km')
    expect(formatDistance(2345.67)).toBe('2,345.7 km')
    expect(formatDistance(20000)).toBe('20,000.0 km')
  })

  it('formats scores with thousands separators', () => {
    expect(formatScore(1234)).toBe('1,234')
  })
})
