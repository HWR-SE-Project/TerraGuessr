import { beforeEach, describe, expect, it } from 'vitest'
import {
  clampRounds,
  DEFAULT_ROUNDS_TOTAL,
  MAX_ROUNDS_TOTAL,
  MIN_ROUNDS_TOTAL,
  readStoredSingleplayerRounds,
  storeSingleplayerRounds,
} from './rounds'

beforeEach(() => {
  localStorage.clear()
})

describe('singleplayer rounds helpers', () => {
  it('defaults to the multiplayer default (5) when nothing is stored', () => {
    expect(readStoredSingleplayerRounds()).toBe(DEFAULT_ROUNDS_TOTAL)
  })

  it('persists and restores finite counts and endless mode', () => {
    storeSingleplayerRounds(7)
    expect(readStoredSingleplayerRounds()).toBe(7)

    storeSingleplayerRounds(null)
    expect(readStoredSingleplayerRounds()).toBeNull()
  })

  it('falls back to default if stored value is outside multiplayer bounds', () => {
    localStorage.setItem('terraguessr.singleplayerRounds.v1', '99')
    expect(readStoredSingleplayerRounds()).toBe(DEFAULT_ROUNDS_TOTAL)

    localStorage.setItem('terraguessr.singleplayerRounds.v1', '2')
    expect(readStoredSingleplayerRounds()).toBe(DEFAULT_ROUNDS_TOTAL)
  })

  it('clamps counts to the multiplayer round bounds', () => {
    expect(clampRounds(1)).toBe(MIN_ROUNDS_TOTAL)
    expect(clampRounds(50)).toBe(MAX_ROUNDS_TOTAL)
    expect(clampRounds(6)).toBe(6)
  })
})
