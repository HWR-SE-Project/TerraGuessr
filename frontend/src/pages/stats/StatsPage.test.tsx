import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  MatchHistoryResponse,
  PlayerStatistics,
  PublicUser,
} from '../../lib/contracts'
import { StatsPage } from './StatsPage'

const mockSession = vi.hoisted(() => ({
  status: 'authed' as 'loading' | 'guest' | 'authed',
  user: null as PublicUser | null,
  preferences: null,
}))

const mockStatsApi = vi.hoisted(() => ({
  getOverview: vi.fn(),
  getMatches: vi.fn(),
}))

vi.mock('../../state/session', () => ({
  useSession: () => mockSession,
}))

vi.mock('../../services', () => ({
  api: {
    stats: mockStatsApi,
  },
}))

vi.mock('./MatchReplayMap', () => ({
  MatchReplayMap: ({ round }: { round: { roundNumber: number; placeName: string | null } }) => (
    <div data-testid="mock-replay-map">
      Round {round.roundNumber}: {round.placeName ?? 'Unknown'}
    </div>
  ),
}))

function sampleStats(overrides: Partial<PlayerStatistics> = {}): PlayerStatistics {
  return {
    period: '30d',
    mode: 'all',
    difficulty: 'all',
    windowStart: '2026-10-26T00:00:00.000Z',
    windowEnd: '2026-11-25T00:00:00.000Z',
    hasPreviousPeriod: true,
    totalRetainedRounds: 12,
    kpis: {
      roundsPlayed: 12,
      matchesPlayed: 4,
      averageScore: 4210,
      medianDistanceKm: 184.5,
      averageDistanceKm: 412.2,
      perfectCount: 3,
      perfectRate: 25,
      timeoutCount: 1,
      timeoutRate: 8.3,
      deltas: {
        roundsPlayed: 4,
        matchesPlayed: 1,
        averageScore: 310,
        medianDistanceKm: -42.5,
        averageDistanceKm: -100,
        perfectRate: 5,
        timeoutRate: -2,
      },
    },
    personalBests: {
      bestRound: {
        score: 5000,
        distanceKm: 18.4,
        placeName: 'Reykjavik',
        mode: 'solo',
        difficulty: 'medium',
        createdAt: '2026-11-24T12:00:00.000Z',
      },
      bestMatch: {
        matchId: 'm-best',
        totalScore: 14500,
        averageScore: 4833,
        rounds: 3,
        mode: 'solo',
        difficulty: 'medium',
        playedAt: '2026-11-24T12:00:00.000Z',
      },
    },
    multiplayer: {
      finishedMatches: 2,
      wins: 1,
      podiums: 2,
      winRate: 50,
      podiumRate: 100,
      averagePlacement: 1.5,
    },
    trend: {
      granularity: 'day',
      points: [
        {
          bucketStart: '2026-11-23',
          rounds: 6,
          averageScore: 3900,
          rollingAverageScore: 3900,
          medianDistanceKm: 240,
        },
        {
          bucketStart: '2026-11-24',
          rounds: 6,
          averageScore: 4520,
          rollingAverageScore: 4210,
          medianDistanceKm: 130,
        },
      ],
    },
    accuracyDistribution: [
      { band: 'bullseye', count: 3, percentage: 25 },
      { band: 'close', count: 4, percentage: 33.3 },
      { band: 'regional', count: 3, percentage: 25 },
      { band: 'continent', count: 1, percentage: 8.3 },
      { band: 'far', count: 0, percentage: 0 },
      { band: 'missed', count: 1, percentage: 8.3 },
    ],
    modeDifficultyMatrix: [
      { mode: 'solo', difficulty: 'easy', rounds: 0, matches: 0, averageScore: null, medianDistanceKm: null, perfectRate: null },
      { mode: 'solo', difficulty: 'medium', rounds: 8, matches: 2, averageScore: 4400, medianDistanceKm: 150, perfectRate: 37.5 },
      { mode: 'solo', difficulty: 'hard', rounds: 0, matches: 0, averageScore: null, medianDistanceKm: null, perfectRate: null },
      { mode: 'multiplayer', difficulty: 'easy', rounds: 0, matches: 0, averageScore: null, medianDistanceKm: null, perfectRate: null },
      { mode: 'multiplayer', difficulty: 'medium', rounds: 4, matches: 2, averageScore: 3830, medianDistanceKm: 320, perfectRate: 0 },
      { mode: 'multiplayer', difficulty: 'hard', rounds: 0, matches: 0, averageScore: null, medianDistanceKm: null, perfectRate: null },
    ],
    consistency: {
      currentPerfectStreak: 2,
      bestPerfectStreak: 2,
      currentPlayStreakDays: 4,
      bestPlayStreakDays: 6,
      scoreStdDev: 540,
      scoreIqr: 620,
      tier: 'rock_solid',
    },
    explorerProfile: [
      {
        id: 'strongest_mode',
        title: 'Medium Solo specialist',
        detail: '4,400 avg pts across 8 rounds',
        tone: 'lime',
      },
    ],
    environment: {
      sampleSize: 6,
      byBiome: [
        { key: 'tundra', rounds: 4, averageScore: 4700, medianDistanceKm: 90, perfectRate: 50 },
        { key: 'desert', rounds: 2, averageScore: 3800, medianDistanceKm: 420, perfectRate: 0 },
      ],
      byWeather: [
        { key: 'snow', rounds: 4, averageScore: 4700, medianDistanceKm: 90, perfectRate: 50 },
      ],
      byTemperatureBand: [
        { key: 'freezing', rounds: 4, averageScore: 4700, medianDistanceKm: 90, perfectRate: 50 },
      ],
    },
    strategy: {
      elapsedSampleSize: 6,
      averageElapsedSeconds: 68,
      attemptsSampleSize: 6,
      averageAttemptsUsed: 1.5,
      hintsSampleSize: 6,
      hints: {
        unlockedRounds: 2,
        notUnlockedRounds: 4,
        usageRate: 33.3,
        unlockedAvgScore: 4600,
        notUnlockedAvgScore: 4100,
        unlockedMedianDistanceKm: 110,
        notUnlockedMedianDistanceKm: 230,
        totalPointsSpent: 200,
      },
    },
    ...overrides,
  }
}

const sampleMatches: MatchHistoryResponse = {
  total: 1,
  offset: 0,
  limit: 15,
  matches: [
    {
      matchId: 'm-1',
      sessionId: 's-1',
      mode: 'multiplayer',
      difficulty: 'medium',
      playedAt: '2026-11-24T12:00:00.000Z',
      totalScore: 9500,
      averageScore: 4750,
      perfectCount: 1,
      matchPlacement: 1,
      matchPlayerCount: 4,
      results: [
        {
          id: 'lobby:r1',
          roundNumber: 1,
          actual: { lat: 64.1466, lon: -21.9426 },
          guess: { lat: 64.1, lon: -21.9 },
          distanceKm: 5.5,
          score: 5000,
          placeName: 'Reykjavik',
          biome: 'tundra',
          weather: 'snow',
          temperatureBand: 'freezing',
          attemptsUsed: 1,
          extraDataUnlocked: false,
          extraDataPointsSpent: 0,
          elapsedSeconds: 42,
          createdAt: '2026-11-24T11:58:00.000Z',
        },
        {
          id: 'lobby:r2',
          roundNumber: 2,
          actual: { lat: 38.7223, lon: -9.1393 },
          guess: { lat: 39.2, lon: -8.9 },
          distanceKm: 56.2,
          score: 4500,
          placeName: 'Lisbon',
          biome: 'coast',
          weather: 'clear',
          temperatureBand: 'warm',
          attemptsUsed: 2,
          extraDataUnlocked: true,
          extraDataPointsSpent: 100,
          elapsedSeconds: 85,
          createdAt: '2026-11-24T12:00:00.000Z',
        },
      ],
    },
  ],
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  mockSession.status = 'authed'
  mockSession.user = {
    id: 'u-1',
    email: 'explorer@example.test',
    displayName: 'Explorer',
    emailVerifiedAt: '2026-11-01T00:00:00Z',
    createdAt: '2026-11-01T00:00:00Z',
  }
  mockStatsApi.getOverview.mockResolvedValue(sampleStats())
  mockStatsApi.getMatches.mockResolvedValue(sampleMatches)
})

describe('StatsPage', () => {
  it('shows a guest preview and sign-in CTA when signed out', () => {
    mockSession.status = 'guest'
    mockSession.user = null

    render(
      <MemoryRouter initialEntries={['/stats']}>
        <StatsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Sign in to track your stats')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth')
    expect(mockStatsApi.getOverview).not.toHaveBeenCalled()
  })

  it('renders KPIs, streaks, explorer profile, and re-fetches when filters change', async () => {
    render(
      <MemoryRouter initialEntries={['/stats']}>
        <StatsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('4,210')).toBeInTheDocument()
    expect(screen.getByText('184.5 km')).toBeInTheDocument()
    expect(screen.getByText('Play streak')).toBeInTheDocument()
    expect(screen.getByText('5K streak')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '7D' }))
    await waitFor(() => {
      expect(mockStatsApi.getOverview).toHaveBeenCalledWith({
        period: '7d',
        mode: 'all',
        difficulty: 'all',
      })
    })
  })

  it('degrades gracefully when only legacy rows (no environment/strategy fields) exist', async () => {
    mockStatsApi.getOverview.mockResolvedValue(
      sampleStats({
        environment: { sampleSize: 0, byBiome: [], byWeather: [], byTemperatureBand: [] },
        strategy: {
          elapsedSampleSize: 0,
          averageElapsedSeconds: null,
          attemptsSampleSize: 0,
          averageAttemptsUsed: null,
          hintsSampleSize: 0,
          hints: {
            unlockedRounds: 0,
            notUnlockedRounds: 0,
            usageRate: null,
            unlockedAvgScore: null,
            notUnlockedAvgScore: null,
            unlockedMedianDistanceKm: null,
            notUnlockedMedianDistanceKm: null,
            totalPointsSpent: 0,
          },
        },
      }),
    )

    render(
      <MemoryRouter initialEntries={['/stats']}>
        <StatsPage />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText(/Older archived rounds didn’t capture biome or weather/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Solve time, attempts, and extra-intel tracking are recorded on newly completed rounds/i),
    ).toBeInTheDocument()
  })

  it('switches to Matches tab and opens the replay dialog with map and round details', async () => {
    render(
      <MemoryRouter initialEntries={['/stats']}>
        <StatsPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('tab', { name: /Matches/i }))

    expect(await screen.findByText('9,500')).toBeInTheDocument()
    expect(screen.getByText('1st / 4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /9,500/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByTestId('mock-replay-map')).toHaveTextContent('Round 1: Reykjavik')
    expect(screen.getByText('Reykjavik')).toBeInTheDocument()
    expect(screen.getByText('Lisbon')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    expect(screen.getByTestId('mock-replay-map')).toHaveTextContent('Round 2: Lisbon')
  })
})
