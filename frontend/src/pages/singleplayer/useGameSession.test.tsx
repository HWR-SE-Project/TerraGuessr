import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { ApiError } from '../../api/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { singleplayerApi } from '../../api/singleplayer'
import { useGameSession } from './useGameSession'
import { browserMapsKey } from '../../game/googleMaps'
import { testRound } from './testRound'
import type { StreetSession } from '../../api/singleplayer'
vi.mock('../../api/singleplayer', () => ({
  singleplayerApi: {
    config: vi.fn(),
    create: vi.fn(),
    session: vi.fn(),
    next: vi.fn(),
    guess: vi.fn(),
    retry: vi.fn(),
    selection: vi.fn(),
    unlock: vi.fn(),
    intelligence: vi.fn(),
    end: vi.fn(),
  },
}))
vi.mock('../../game/googleMaps', () => ({
  browserMapsKey: vi.fn(() => 'test-only-key'),
}))
const empty: StreetSession = {
  id: 'test-game',
  difficulty: 'medium',
  activeRound: null,
  results: [],
  totalScore: 0,
}
const round = testRound({ id: 'test-round', number: 1, panoId: 'test-only-panorama' })
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  vi.mocked(browserMapsKey).mockReturnValue('test-only-key')
  vi.mocked(singleplayerApi.config).mockResolvedValue({
    available: true,
    provider: 'google',
    serverKeyConfigured: true,
  })
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
    vi.mocked(singleplayerApi.guess).mockResolvedValue({
      finalized: true,
      attemptsRemaining: 0,
      result: scored,
    })
    await act(async () => {
      await Promise.all([result.current.submit(), result.current.submit()])
    })
    expect(singleplayerApi.guess).toHaveBeenCalledTimes(1)
    expect(result.current.result).toEqual(scored)
    expect(result.current.session.totalScore).toBe(527)
  })
  it('allows submitting a guess when the panorama is unavailable (R07)', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    act(() => {
      result.current.setGuess({ lat: 10, lon: 20 })
      result.current.setPanoramaUnavailable(true)
    })
    vi.mocked(singleplayerApi.guess).mockResolvedValue({
      finalized: false,
      attemptsRemaining: 2,
    })
    await act(() => result.current.submit(false))
    expect(singleplayerApi.guess).toHaveBeenCalledTimes(1)
  })
  it('keeps the round open after a non-final attempt', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    act(() => {
      result.current.setGuess({ lat: 10, lon: 20 })
      result.current.setPanoramaReady(true)
    })
    vi.mocked(singleplayerApi.guess).mockResolvedValueOnce({
      finalized: false,
      attemptsRemaining: 1,
    })
    await act(() => result.current.submit(false))
    expect(result.current.result).toBeNull()
    expect(result.current.session.activeRound?.attemptsUsed).toBe(1)
    expect(result.current.guess).toEqual({ lat: 10, lon: 20 })
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
  it('never auto-resumes from a stale sessionStorage entry left by a previous build or tab (R06/R13)', async () => {
    sessionStorage.setItem(
      'terraguessr.streetSession.v1',
      JSON.stringify({ id: 'test-game', playerToken: 'test-token' }),
    )
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.checking).toBe(false))
    expect(result.current.session.id).toBe('')
    expect(result.current.session.activeRound).toBeNull()
    expect(result.current.showFinal).toBe(false)
    expect(singleplayerApi.session).not.toHaveBeenCalled()
    expect(singleplayerApi.create).not.toHaveBeenCalled()
  })
  it('never writes session credentials or guesses to storage — nothing can be resumed after a reload', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    act(() => result.current.setGuess({ lat: 10, lon: 20 }))
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.getItem('terraguessr.streetSession.v1')).toBeNull()
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
  it('creates a new game with the requested difficulty (R05)', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next({ difficulty: 'easy' }))
    expect(singleplayerApi.create).toHaveBeenCalledWith('easy')
  })
  it('creates a new game without a difficulty when none is given, letting the server default apply', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    expect(singleplayerApi.create).toHaveBeenCalledWith(undefined)
  })
  it('carries easy-mode candidates through to the active round (R07)', async () => {
    const candidates = [
      { id: '0', name: 'London', region: 'EUROPE', lat: 51.5, lon: -0.1 },
      { id: '1', name: 'Paris', region: 'EUROPE', lat: 48.9, lon: 2.3 },
    ]
    vi.mocked(singleplayerApi.next).mockResolvedValue({ ...round, candidates })
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next({ difficulty: 'easy' }))
    expect(result.current.session.activeRound?.candidates).toEqual(candidates)
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
  it('advances through ten consecutive rounds with no cap, then ends the game to show its summary, then restarts with a fresh session', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    const history: StreetSession['results'] = []
    const ROUNDS = 10 // Past the old five-round cap — endless mode.
    for (let number = 1; number <= ROUNDS; number++) {
      const activeRound = testRound({
        id: `test-round-${number}`,
        number,
        panoId: `test-pano-${number}`,
      })
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
      vi.mocked(singleplayerApi.guess).mockResolvedValueOnce({
        finalized: true,
        attemptsRemaining: 0,
        result: accepted,
      })
      await act(() => result.current.submit())
      history.push(accepted)
      // Next Round is always available — no fixed-round completion flag exists.
      expect(result.current.showFinal).toBe(false)
    }
    expect(result.current.session.totalScore).toBe(10_000)
    expect(result.current.session.results).toHaveLength(ROUNDS)
    // The game only ends when the player explicitly ends it.
    vi.mocked(singleplayerApi.end).mockResolvedValueOnce(undefined)
    let ended = false
    await act(async () => {
      ended = await result.current.endGame()
    })
    expect(ended).toBe(true)
    expect(singleplayerApi.end).toHaveBeenCalledTimes(1)
    expect(result.current.showFinal).toBe(true)
    // The summary still shows the full session — ending never discards results.
    expect(result.current.session.totalScore).toBe(10_000)
    expect(result.current.session.results).toHaveLength(ROUNDS)
    vi.mocked(singleplayerApi.create).mockResolvedValueOnce({
      id: 'second-game',
      playerToken: 'second-token',
    })
    vi.mocked(singleplayerApi.session).mockResolvedValueOnce({
      ...empty,
      id: 'second-game',
      activeRound: round,
    })
    await act(() => result.current.next({ restart: true }))
    expect(singleplayerApi.create).toHaveBeenCalledTimes(2)
    expect(result.current.session.totalScore).toBe(0)
    expect(result.current.session.results).toHaveLength(0)
    expect(result.current.showFinal).toBe(false)
  })
})

describe('configured gameplay recovery', () => {
  it('reports both missing credentials instead of skipping the backend check', async () => {
    vi.mocked(browserMapsKey).mockReturnValue('')
    vi.mocked(singleplayerApi.config).mockResolvedValue({
      available: false,
      provider: 'google',
      serverKeyConfigured: false,
    })
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.checking).toBe(false))
    expect(singleplayerApi.config).toHaveBeenCalledOnce()
    expect(result.current.setupIssues).toHaveLength(2)
    expect(result.current.setupIssues.join(' ')).toContain(
      'VITE_GOOGLE_MAPS_API_KEY',
    )
    expect(result.current.setupIssues.join(' ')).toContain(
      'GOOGLE_MAPS_SERVER_API_KEY',
    )
  })
  it('starts one session automatically from Play Solo, including StrictMode', async () => {
    const { result } = renderHook(() => useGameSession(true), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    })
    await waitFor(() =>
      expect(result.current.session.activeRound).toEqual(round),
    )
    expect(singleplayerApi.create).toHaveBeenCalledTimes(1)
    expect(singleplayerApi.next).toHaveBeenCalledTimes(1)
  })
  it('ignores a stale selected-pin entry left in storage by a previous build — guesses are never read back (R06/R13)', async () => {
    sessionStorage.setItem(
      'terraguessr.streetGuess.v1',
      JSON.stringify({
        gameId: 'test-game',
        roundId: round.id,
        guess: { lat: 12, lon: 34 },
      }),
    )
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    expect(result.current.session.activeRound).toEqual(round)
    expect(result.current.guess).toBeNull()
  })
  it('replaces a failed panorama without skipping or scoring the round', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    act(() => result.current.setGuess({ lat: 12, lon: 34 }))
    vi.mocked(singleplayerApi.retry).mockResolvedValueOnce({
      ...round,
      panoId: 'replacement-panorama',
    })
    await act(() => result.current.retryLocation())
    expect(result.current.session.activeRound).toEqual({
      ...round,
      panoId: 'replacement-panorama',
    })
    expect(result.current.session.results).toHaveLength(0)
    expect(result.current.guess).toBeNull()
    expect(singleplayerApi.guess).not.toHaveBeenCalled()
  })
  it('lets an expired expedition start again instead of remaining stuck', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    act(() => {
      result.current.setGuess({ lat: 12, lon: 34 })
      result.current.setPanoramaReady(true)
    })
    const expired = new ApiError('NOT_FOUND', 'Game not found', 404)
    vi.mocked(singleplayerApi.guess).mockRejectedValueOnce(expired)
    vi.mocked(singleplayerApi.session).mockRejectedValueOnce(expired)
    await act(() => result.current.submit())
    expect(result.current.session.id).toBe('')
    expect(result.current.error).toContain('expired')
  })
})

describe('exit flow: end game (R04/R06 — no Save & Exit, no resume)', () => {
  it('finalizes the session server-side and keeps the results visible for the summary screen', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    vi.mocked(singleplayerApi.end).mockResolvedValueOnce(undefined)
    let ok = false
    await act(async () => {
      ok = await result.current.endGame()
    })
    expect(ok).toBe(true)
    expect(singleplayerApi.end).toHaveBeenCalledWith({
      id: 'test-game',
      playerToken: 'test-token',
    })
    expect(result.current.exitError).toBeNull()
    expect(result.current.showFinal).toBe(true)
    // The round the player was mid-way through is cleared, but the session
    // (id, difficulty, accumulated results) is not reset to empty.
    expect(result.current.session.id).toBe('test-game')
  })
  it('treats an already-gone session as a successful end instead of an error', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    vi.mocked(singleplayerApi.end).mockRejectedValueOnce(
      new ApiError('NOT_FOUND', 'Game not found', 404),
    )
    let ok = false
    await act(async () => {
      ok = await result.current.endGame()
    })
    expect(ok).toBe(true)
    expect(result.current.exitError).toBeNull()
    expect(result.current.showFinal).toBe(true)
  })
  it('keeps the session active and surfaces an error when ending fails for a real reason', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    vi.mocked(singleplayerApi.end).mockRejectedValueOnce(
      new Error('Network unavailable'),
    )
    let ok = true
    await act(async () => {
      ok = await result.current.endGame()
    })
    expect(ok).toBe(false)
    expect(result.current.exitError).toEqual({
      action: 'end',
      message: expect.stringContaining('Unable to reach'),
    })
    expect(result.current.showFinal).toBe(false)
    expect(result.current.session.id).toBe('test-game')
    expect(result.current.session.activeRound).toEqual(round)
  })
  it('guards against duplicate concurrent End Game requests', async () => {
    const { result } = renderHook(useGameSession)
    await waitFor(() => expect(result.current.available).toBe(true))
    await act(() => result.current.next())
    let resolveEnd: (value: void) => void = () => {}
    vi.mocked(singleplayerApi.end).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveEnd = resolve
      }),
    )
    let first: Promise<boolean> = Promise.resolve(false)
    let second = false
    await act(async () => {
      first = result.current.endGame()
      second = await result.current.endGame()
    })
    expect(second).toBe(false)
    resolveEnd()
    await act(async () => {
      expect(await first).toBe(true)
    })
  })
})
