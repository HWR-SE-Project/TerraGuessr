import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../services'
import { setGameCredentials } from '../../state/game'
import { SingleplayerGamePage } from './SingleplayerGamePage'

afterEach(() => {
  cleanup()
  setGameCredentials(null)
  vi.restoreAllMocks()
})

describe('SingleplayerGamePage start failures', () => {
  it('displays a clear error screen instead of the session summary when weather retrieval fails, and allows retrying', async () => {
    const user = userEvent.setup()
    const errorMessage = 'No location with available weather data could be found nearby. Please retry.'
    setGameCredentials({ id: 'game-1', playerToken: 'token-1' })

    vi.spyOn(api.singleplayer, 'session').mockResolvedValue({
      id: 'game-1',
      difficulty: 'easy',
      totalScore: 0,
      activeRound: null,
      results: [],
    })
    const nextSpy = vi.spyOn(api.singleplayer, 'next')
      .mockRejectedValueOnce(new Error(errorMessage))
      .mockResolvedValueOnce({
        id: 'round-1',
        number: 1,
        scene: {
          biome: 'urban',
          weather: 'clear',
          lighting: 'day',
          temperatureBand: 'mild',
          windBand: 'calm',
          seed: 42,
        },
        startedAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 420_000).toISOString(),
        attemptsUsed: 0,
        attemptsTotal: 3,
        rules: {
          timeLimitSeconds: 420,
          attemptsPerRound: 3,
          selectionMode: 'list',
          countryBorders: true,
          extraData: { mode: 'free' },
        },
        selection: null,
        candidates: [{ id: '0', name: 'London', region: 'EUROPE' }],
        extraData: { mode: 'immediate', cost: null, availableAt: null, unlocked: true, pointsSpent: 0 },
      })
    vi.spyOn(api.singleplayer, 'intelligence').mockResolvedValue({
      fetchedAt: new Date().toISOString(),
      cached: false,
      weather: {
        modelTime: new Date().toISOString(),
        temperatureC: 12,
        condition: 'Clear sky',
        windSpeedKmh: 7.2,
        windDirectionDeg: null,
        humidityPct: 60,
        pressureHpa: 1012,
        precipitationMm: 0,
        precipitationIntervalMinutes: 15,
      },
      environment: { elevationM: 10, reliefM: 5, terrain: 'Low relief', biome: null, vegetation: null },
      climate: null,
    })

    render(
      <MemoryRouter>
        <SingleplayerGamePage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Could not start the game' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage)
    expect(screen.queryByText('Well explored!')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(nextSpy).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('button', { name: 'Submit guess' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Could not start the game' })).not.toBeInTheDocument()
  })
})
