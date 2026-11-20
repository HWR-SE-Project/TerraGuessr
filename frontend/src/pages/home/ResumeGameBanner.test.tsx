import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { singleplayerApi } from '../../api/singleplayer'
import type { StreetSession } from '../../api/singleplayer'
import { STREET_SESSION_STORAGE_KEY } from '../singleplayer/useGameSession'
import { ResumeGameBanner } from './ResumeGameBanner'

vi.mock('../../api/singleplayer', () => ({
  singleplayerApi: { session: vi.fn() },
}))

const empty: StreetSession = {
  id: 'test-game',
  roundsTotal: 5,
  difficulty: 'medium',
  activeRound: null,
  results: [],
  totalScore: 0,
  completed: false,
}

function renderBanner() {
  render(
    <MemoryRouter>
      <ResumeGameBanner />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('ResumeGameBanner', () => {
  it('renders nothing when there is no saved session', () => {
    renderBanner()
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('renders nothing when the saved session has expired or is unreachable', async () => {
    sessionStorage.setItem(
      STREET_SESSION_STORAGE_KEY,
      JSON.stringify({ id: 'test-game', playerToken: 'test-token' }),
    )
    vi.mocked(singleplayerApi.session).mockRejectedValue(new Error('404'))
    renderBanner()
    await waitFor(() => expect(singleplayerApi.session).toHaveBeenCalled())
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('renders nothing once the expedition is already completed', async () => {
    sessionStorage.setItem(
      STREET_SESSION_STORAGE_KEY,
      JSON.stringify({ id: 'test-game', playerToken: 'test-token' }),
    )
    vi.mocked(singleplayerApi.session).mockResolvedValue({
      ...empty,
      completed: true,
      totalScore: 12000,
    })
    renderBanner()
    await waitFor(() => expect(singleplayerApi.session).toHaveBeenCalled())
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('shows round, score, and difficulty, and links back into the game for an incomplete session', async () => {
    sessionStorage.setItem(
      STREET_SESSION_STORAGE_KEY,
      JSON.stringify({ id: 'test-game', playerToken: 'test-token' }),
    )
    vi.mocked(singleplayerApi.session).mockResolvedValue({
      ...empty,
      difficulty: 'hard',
      totalScore: 8240,
      results: [
        {
          roundId: 'r1',
          number: 1,
          guess: { lat: 1, lon: 1 },
          actual: { lat: 2, lon: 2 },
          distanceKm: 100,
          score: 4000,
        },
        {
          roundId: 'r2',
          number: 2,
          guess: { lat: 1, lon: 1 },
          actual: { lat: 2, lon: 2 },
          distanceKm: 100,
          score: 4240,
        },
      ],
      activeRound: { id: 'r3', number: 3, panoId: 'pano-3' },
    })
    renderBanner()
    await waitFor(() =>
      expect(screen.getByRole('complementary')).toBeVisible(),
    )
    expect(screen.getByText(/Round 3 of 5/)).toBeVisible()
    expect(screen.getByText(/8,240 pts/)).toBeVisible()
    expect(screen.getByText(/Hard/)).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Resume Game/ }),
    ).toHaveAttribute('href', '/game/singleplayer')
  })
})
