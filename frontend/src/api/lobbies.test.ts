import { afterEach, describe, expect, it } from 'vitest'
import {
  clearLobbyToken,
  getLobbyToken,
  setLobbyToken,
} from './lobbies'

describe('lobby token storage', () => {
  afterEach(() => localStorage.clear())

  it('scopes tokens per uppercase lobby code', () => {
    setLobbyToken('abc234', 'token-a')
    expect(getLobbyToken('ABC234')).toBe('token-a')
    expect(getLobbyToken('ZZZ999')).toBeNull()

    setLobbyToken('ZZZ999', 'token-z')
    expect(getLobbyToken('abc234')).toBe('token-a')
    expect(getLobbyToken('zzz999')).toBe('token-z')
  })

  it('clears only the requested lobby token', () => {
    setLobbyToken('ABC234', 'token-a')
    setLobbyToken('ZZZ999', 'token-z')

    clearLobbyToken('abc234')

    expect(getLobbyToken('ABC234')).toBeNull()
    expect(getLobbyToken('ZZZ999')).toBe('token-z')
  })

  it('never overwrites the game player token', () => {
    localStorage.setItem('terraguessr.playerToken', 'game-token')
    setLobbyToken('ABC234', 'lobby-token')
    expect(localStorage.getItem('terraguessr.playerToken')).toBe('game-token')
  })
})
