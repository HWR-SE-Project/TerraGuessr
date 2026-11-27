import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LobbyMatchResponse } from '../../lib/contracts'
import { api } from '../../services'
import { clearLobbySession, setLobbySession } from '../../state/lobby'
import { MultiplayerGamePage } from './MultiplayerGamePage'

function reviewMatchResponse(overrides?: {
  reviewPrompt?: LobbyMatchResponse['match']['reviewPrompt']
  currentRound?: number
  reviewEndsAt?: string | null
}): LobbyMatchResponse {
  const now = Date.now()
  const reviewEndsAt = overrides?.reviewEndsAt === undefined
    ? new Date(now + 15_000).toISOString()
    : overrides.reviewEndsAt
  const currentRound = overrides?.currentRound ?? 1
  const inReview = reviewEndsAt !== null
  const result = {
    roundNumber: 1,
    score: 5000,
    distanceKm: 12.4,
    guess: { lat: 51.5, lon: -0.1 },
    actual: { lat: 51.5074, lon: -0.1278 },
    placeName: 'London',
    attemptsUsed: 1,
    extraDataPointsSpent: 0,
    attempts: [],
    guesses: [
      {
        memberId: 'm1',
        displayName: 'Host',
        isHost: true,
        isYou: true,
        guess: { lat: 51.5, lon: -0.1 },
        distanceKm: 12.4,
        score: 5000,
        answer: 'London',
      },
      {
        memberId: 'm2',
        displayName: 'Guest',
        isHost: false,
        isYou: false,
        guess: { lat: 48.85, lon: 2.35 },
        distanceKm: 343.5,
        score: 4800,
        answer: 'Paris',
      },
    ],
  }

  return {
    lobby: {
      lobbyId: 'lobby-1',
      code: 'AB3C9X',
      difficulty: 'easy',
      status: 'playing',
      roundsTotal: 3,
      maxMembers: 16,
      rules: {
        timeLimitSeconds: 420,
        attemptsPerRound: 3,
        selectionMode: 'list',
        countryBorders: true,
        extraData: { mode: 'free' },
      },
      createdAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
      members: [
        { displayName: 'Host', isHost: true, isYou: true, joinedAt: new Date(now - 60_000).toISOString() },
        { displayName: 'Guest', isHost: false, isYou: false, joinedAt: new Date(now - 50_000).toISOString() },
      ],
      youAreHost: true,
    },
    match: {
      matchId: 'match-1',
      status: 'playing',
      currentRound,
      roundsTotal: 3,
      difficulty: 'easy',
      rules: {
        timeLimitSeconds: 420,
        attemptsPerRound: 3,
        selectionMode: 'list',
        countryBorders: true,
        extraData: { mode: 'free' },
      },
      startedAt: new Date(now - 30_000).toISOString(),
      endsAt: inReview ? null : new Date(now + 420_000).toISOString(),
      round: {
        id: `round-${currentRound}`,
        number: currentRound,
        scene: {
          biome: 'urban',
          weather: 'clear',
          lighting: 'day',
          temperatureBand: 'mild',
          windBand: 'calm',
          seed: 42,
        },
        candidates: [{ id: '0', name: 'London', region: 'EUROPE', lat: 51.5074, lon: -0.1278 }],
        endsAt: inReview ? null : new Date(now + 420_000).toISOString(),
        attemptsUsed: inReview ? 1 : 0,
        attemptsTotal: 3,
        extraData: { mode: 'immediate', cost: null, availableAt: null, unlocked: true, pointsSpent: 0 },
      },
      roundComplete: inReview,
      reviewEndsAt,
      reviewPrompt: inReview
        ? (overrides?.reviewPrompt ?? {
            readyPlayers: [],
            pendingPlayers: ['Host', 'Guest'],
            youReady: false,
          })
        : null,
      pendingPlayers: [],
      you: {
        attemptsUsed: inReview ? 1 : 0,
        attemptsTotal: 3,
        selection: null,
        selectedCandidateId: null,
        submittedGuesses: [],
        submittedCandidateIds: [],
        finalized: inReview,
        result: inReview ? result : null,
      },
      leaderboard: [
        { memberId: 'm1', rank: 1, displayName: 'Host', isHost: true, isYou: true, totalScore: 5000, roundsCompleted: 1 },
        { memberId: 'm2', rank: 2, displayName: 'Guest', isHost: false, isYou: false, totalScore: 4800, roundsCompleted: 1 },
      ],
      results: [result],
      continuePrompt: null,
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  clearLobbySession()
})

afterEach(() => {
  cleanup()
  clearLobbySession()
  vi.restoreAllMocks()
})

describe('MultiplayerGamePage round review continue button', () => {
  it('lets a player click Continue during round review and shows waiting status until others are ready', async () => {
    const user = userEvent.setup()
    setLobbySession({ code: 'AB3C9X', token: 'token-host', isHost: true })

    const initial = reviewMatchResponse()
    const afterReady = reviewMatchResponse({
      reviewPrompt: {
        readyPlayers: ['Host'],
        pendingPlayers: ['Guest'],
        youReady: true,
      },
    })

    const matchSpy = vi.spyOn(api.lobby, 'match').mockResolvedValue(initial)
    const continueSpy = vi.spyOn(api.lobby, 'continueReview').mockImplementation(async () => {
      matchSpy.mockResolvedValue(afterReady)
      return afterReady
    })

    render(
      <MemoryRouter initialEntries={['/lobby/AB3C9X/play']}>
        <Routes>
          <Route path="/lobby/:code/play" element={<MultiplayerGamePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Round 1 results')).toBeInTheDocument()
    const continueBtn = screen.getByRole('button', { name: 'Continue' })
    expect(continueBtn).toBeEnabled()

    await user.click(continueBtn)

    expect(continueSpy).toHaveBeenCalledWith('AB3C9X', 1, 'token-host')
    expect(await screen.findByText('1/2 ready · Waiting for Guest')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ready' })).toBeDisabled()
  })
})
