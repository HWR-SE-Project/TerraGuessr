import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGameplaySettings } from './settings'

const key = 'terraguessr.gameplay.settings'
afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('game settings ownership and persistence', () => {
  it('validates stored settings and clamps opacity before either game uses them', () => {
    localStorage.setItem(key, JSON.stringify({ compass: false, hoverExpand: 'yes', mapOpacity: 900 }))
    const { result } = renderHook(useGameplaySettings)
    expect(result.current[0]).toEqual({ compass: false, hoverExpand: true, scrollZoom: true, mapOpacity: 100 })
  })

  it('restores the previous game’s preferences in the next game without sharing live state', () => {
    const singleplayer = renderHook(useGameplaySettings)
    act(() => singleplayer.result.current[1]({ ...singleplayer.result.current[0], compass: false, mapOpacity: 70 }))
    singleplayer.unmount()
    const multiplayer = renderHook(useGameplaySettings)
    expect(multiplayer.result.current[0]).toMatchObject({ compass: false, mapOpacity: 70 })
  })

  it('keeps controls usable when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    const { result } = renderHook(useGameplaySettings)
    act(() => result.current[1]({ ...result.current[0], compass: false }))
    expect(result.current[0].compass).toBe(false)
  })
})
