import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { singleplayerApi } from '../../api/singleplayer'
import { useGameSession } from './useGameSession'
import { browserMapsKey } from './googleMaps'
import type { StreetSession } from '../../api/singleplayer'
vi.mock('../../api/singleplayer', () => ({
  singleplayerApi: {
    config: vi.fn(),
    create: vi.fn(),
    session: vi.fn(),
    next: vi.fn(),
    guess: vi.fn(),
  },
}))
vi.mock('./googleMaps', () => ({
  browserMapsKey: vi.fn(() => 'test-only-key'),
}))
const empty: StreetSession = {
  id: 'test-game',
  roundsTotal: 5,
  activeRound: null,
  results: [],
  totalScore: 0,
  completed: false,
}
const round = { id: 'test-round', number: 1, panoId: 'test-only-panorama' }
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  vi.mocked(browserMapsKey).mockReturnValue('test-only-key')
  vi.mocked(singleplayerApi.config).mockResolvedValue({ available: true })
  vi.mocked(singleplayerApi.create).mockResolvedValue({
    id: 'test-game',
    playerToken: 'test-token',
  })
  vi.mocked(singleplayerApi.next).mockResolvedValue(round)
  vi.mocked(singleplayerApi.session).mockResolvedValue({
    ...empty,
    activeRound: round,
  })
})
describe('singleplayer session controller (API doubles)', () => {
  it('does not start a paid session automatically and handles missing credentials', async () => {
    vi.mocked(browserMapsKey).mockReturnValue('')
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.checking).toBe(false))
    expect(result.current.available).toBe(false)
    expect(singleplayerApi.create).not.toHaveBeenCalled()
  })
  it('requires both a guess and a loaded panorama and guards duplicate submissions', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    await act(() => result.current.submit())
    expect(singleplayerApi.guess).not.toHaveBeenCalled()
    act(() => result.current.setGuess({ lat: 10, lon: 20 }))
    await act(() => result.current.submit())
    expect(singleplayerApi.guess).not.toHaveBeenCalled()
    act(() => result.current.setPanoramaReady(true))
    const scored = {
      roundId: round.id,
      number: 1,
      guess: { lat: 10, lon: 20 },
      actual: { lat: 50, lon: 10 },
      distanceKm: 4500,
      score: 527,
    }
    vi.mocked(singleplayerApi.guess).mockResolvedValue(scored)
    await act(async () => {
      await Promise.all([result.current.submit(), result.current.submit()])
    })
    expect(singleplayerApi.guess).toHaveBeenCalledTimes(1)
    expect(result.current.result).toEqual(scored)
    expect(result.current.session.totalScore).toBe(527)
  })
  it('keeps the current round and guess after a network error so the same guess can be retried', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    act(() => {
      result.current.setGuess({ lat: 10, lon: 20 })
      result.current.setPanoramaReady(true)
    })
    vi.mocked(singleplayerApi.guess).mockRejectedValueOnce(
      new Error('Network unavailable'),
    )
    await act(() => result.current.submit())
    expect(result.current.error).toBe('Network unavailable')
    expect(result.current.guess).toEqual({ lat: 10, lon: 20 })
    expect(result.current.session.activeRound).toEqual(round)
  })
  it('restores the completed game and shows final results on refresh', async () => {
    sessionStorage.setItem(
      'terraguessr.streetSession.v1',
      JSON.stringify({ id: 'test-game', playerToken: 'test-token' }),
    )
    vi.mocked(singleplayerApi.session).mockResolvedValue({
      ...empty,
      completed: true,
      totalScore: 21000,
    })
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.showFinal).toBe(true))
    expect(result.current.session.totalScore).toBe(21000)
    expect(singleplayerApi.create).not.toHaveBeenCalled()
  })
  it('retries the existing session after first-round provider failure', async () => {
    vi.mocked(singleplayerApi.next).mockRejectedValueOnce(
      new Error('No coverage'),
    )
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    expect(result.current.error).toBe('No coverage')
    await act(() => result.current.next())
    expect(singleplayerApi.create).toHaveBeenCalledTimes(1)
    expect(result.current.session.activeRound).toEqual(round)
  })
})

describe('recovery and complete expedition', () => {
  it('recovers an accepted guess after its response is lost', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    act(() => {
      result.current.setGuess({ lat: 10, lon: 20 })
      result.current.setPanoramaReady(true)
    })
    const accepted = {
      roundId: round.id,
      number: 1,
      guess: { lat: 10, lon: 20 },
      actual: { lat: 50, lon: 10 },
      distanceKm: 4500,
      score: 527,
    }
    vi.mocked(singleplayerApi.guess).mockRejectedValueOnce(
      new Error('Response disconnected'),
    )
    vi.mocked(singleplayerApi.session).mockResolvedValue({
      ...empty,
      results: [accepted],
      totalScore: 527,
    })
    await act(() => result.current.submit())
    expect(result.current.result).toEqual(accepted)
    expect(result.current.session.totalScore).toBe(527)
    expect(result.current.error).toBeNull()
  })
  it('handles server unavailability without creating a session', async () => {
    vi.mocked(singleplayerApi.config).mockRejectedValue(new Error('Offline'))
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.checking).toBe(false))
    expect(result.current.available).toBe(false)
    expect(result.current.error).toContain('Unable to reach')
    expect(singleplayerApi.create).not.toHaveBeenCalled()
  })
  it('advances through five rounds with API doubles, shows the total, then restarts with a new session', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    const history: StreetSession['results'] = []
    for (let number = 1; number <= 5; number++) {
      const activeRound = {
        id: `test-round-${number}`,
        number,
        panoId: `test-pano-${number}`,
      }
      vi.mocked(singleplayerApi.next).mockResolvedValueOnce(activeRound)
      vi.mocked(singleplayerApi.session).mockResolvedValueOnce({
        ...empty,
        results: [...history],
        activeRound,
        totalScore: history.length * 1000,
      })
      await act(() => result.current.next())
      expect(result.current.guess).toBeNull()
      expect(result.current.panoramaReady).toBe(false)
      act(() => {
        result.current.setGuess({ lat: 10, lon: 20 })
        result.current.setPanoramaReady(true)
      })
      const accepted = {
        roundId: activeRound.id,
        number,
        guess: { lat: 10, lon: 20 },
        actual: { lat: 50, lon: 10 },
        distanceKm: 3218.88,
        score: 1000,
      }
      vi.mocked(singleplayerApi.guess).mockResolvedValueOnce(accepted)
      await act(() => result.current.submit())
      history.push(accepted)
    }
    expect(result.current.session.completed).toBe(true)
    expect(result.current.session.totalScore).toBe(5000)
    expect(result.current.session.results).toHaveLength(5)
    act(() => result.current.finish())
    expect(result.current.showFinal).toBe(true)
    vi.mocked(singleplayerApi.create).mockResolvedValueOnce({
      id: 'second-game',
      playerToken: 'second-token',
    })
    vi.mocked(singleplayerApi.session).mockResolvedValueOnce({
      ...empty,
      id: 'second-game',
      activeRound: round,
    })
    await act(() => result.current.next(true))
    expect(singleplayerApi.create).toHaveBeenCalledTimes(2)
    expect(result.current.session.totalScore).toBe(0)
    expect(result.current.showFinal).toBe(false)
  })
})
