import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as challengesApi from '../../api/challenges'
import * as gamesApi from '../../api/games'
import * as roundsApi from '../../api/rounds'
import type { RoundDTO } from '../../api/types'
import { useDuelFlow } from './useDuelFlow'

vi.mock('../../api/games')
vi.mock('../../api/rounds')
vi.mock('../../api/challenges')

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

const round: RoundDTO = {
  roundId: 'round-1',
  roundNumber: 1,
  attemptsTotal: 1,
  difficulty: 'medium',
  selectionMode: 'map',
  weather: {
    temperatureC: 10,
    precipitationMm: 0,
    humidityPct: 50,
    windSpeedKmh: 5,
    airPressureHpa: null,
    windDirectionDeg: null,
    uvIndex: null,
    sunshineDurationSeconds: null,
    localTime: null,
  },
  additionalData: { mode: 'immediate', cost: null, availableAt: null, unlocked: true },
}

describe('useDuelFlow', () => {
  afterEach(() => vi.resetAllMocks())

  it('starts idle', () => {
    const { result } = renderHook(() => useDuelFlow(), { wrapper })
    expect(result.current.stage).toEqual({ kind: 'idle' })
  })

  it('creates a single-round challenge game and transitions to the round stage', async () => {
    vi.mocked(gamesApi.createGame).mockResolvedValue({
      gameId: 'g1',
      playerToken: 'tok',
      roundsTotal: 1,
      attemptsPerRound: 1,
      additionalDataUnlockMode: 'immediate',
      additionalDataUnlockCost: null,
    })
    vi.mocked(roundsApi.startRound).mockResolvedValue(round)

    const { result } = renderHook(() => useDuelFlow(), { wrapper })

    await act(async () => {
      await result.current.start()
    })

    expect(gamesApi.createGame).toHaveBeenCalledWith({ mode: 'challenge', difficulty: 'medium', roundsTotal: 1 })
    expect(roundsApi.startRound).toHaveBeenCalledWith('g1', 'map', 'tok')
    expect(result.current.stage).toEqual({ kind: 'round', round })
  })

  it('submits a guess, creates a challenge link, and navigates to it', async () => {
    vi.mocked(gamesApi.createGame).mockResolvedValue({
      gameId: 'g1',
      playerToken: 'tok',
      roundsTotal: 1,
      attemptsPerRound: 1,
      additionalDataUnlockMode: 'immediate',
      additionalDataUnlockCost: null,
    })
    vi.mocked(roundsApi.startRound).mockResolvedValue(round)
    vi.mocked(roundsApi.submitGuess).mockResolvedValue({ resultId: 'res-1', distanceKm: 12.3, score: 4800, actual: { lat: 1, lon: 1 } })
    vi.mocked(challengesApi.createChallenge).mockResolvedValue({ challengeId: 'chal-1', shareUrl: '/challenge/chal-1' })

    const { result } = renderHook(() => useDuelFlow(), { wrapper })
    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      await result.current.submitGuess({ lat: 1, lon: 1 })
    })

    expect(roundsApi.submitGuess).toHaveBeenCalledWith('round-1', { lat: 1, lon: 1 })
    expect(challengesApi.createChallenge).toHaveBeenCalledWith('round-1')
    expect(navigateMock).toHaveBeenCalledWith('/challenge/chal-1', {
      state: {
        justCreated: true,
        shareUrl: '/challenge/chal-1',
        score: 4800,
        result: { resultId: 'res-1', distanceKm: 12.3, score: 4800, actual: { lat: 1, lon: 1 } },
        guess: { lat: 1, lon: 1 },
      },
    })
  })

  it('moves to the error stage when starting a duel fails', async () => {
    vi.mocked(gamesApi.createGame).mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useDuelFlow(), { wrapper })
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.stage).toEqual({ kind: 'error', message: 'offline' })
  })

  it('reset returns to idle', async () => {
    vi.mocked(gamesApi.createGame).mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useDuelFlow(), { wrapper })
    await act(async () => {
      await result.current.start()
    })
    await waitFor(() => expect(result.current.stage.kind).toBe('error'))

    act(() => result.current.reset())

    expect(result.current.stage).toEqual({ kind: 'idle' })
  })
})
