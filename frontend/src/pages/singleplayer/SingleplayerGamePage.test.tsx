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
        candidates: [{ id: '0', name: 'London', region: 'EUROPE', lat: 51.5074, lon: -0.1278 }],
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

  it('places Play again and Back home above the scrollable round breakdown on the summary screen', async () => {
    const user = userEvent.setup()
    setGameCredentials({ id: 'game-2', playerToken: 'token-2' })

    vi.spyOn(api.singleplayer, 'session').mockResolvedValue({
      id: 'game-2',
      difficulty: 'easy',
      totalScore: 7480,
      activeRound: null,
      results: [
        {
          roundId: 'round-1',
          number: 1,
          guess: { lat: 48.85, lon: 2.35 },
          actual: { lat: 51.5, lon: -0.12 },
          distanceKm: 343.5,
          score: 2480,
        },
        {
          roundId: 'round-2',
          number: 2,
          guess: { lat: 35.68, lon: 139.76 },
          actual: { lat: 35.68, lon: 139.76 },
          distanceKm: 0,
          score: 5000,
        },
      ],
    })
    vi.spyOn(api.singleplayer, 'next').mockRejectedValueOnce(new Error('Temporary error'))

    render(
      <MemoryRouter>
        <SingleplayerGamePage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'View summary' }))

    const playAgain = await screen.findByRole('button', { name: 'Play again' })
    const backHome = screen.getByRole('button', { name: 'Back home' })
    const breakdown = screen.getByRole('region', { name: 'Round breakdown' })

    expect(playAgain.compareDocumentPosition(breakdown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(backHome.compareDocumentPosition(breakdown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(breakdown).toHaveTextContent('Round 1')
    expect(breakdown).toHaveTextContent('Round 2')
  })
})

describe('SingleplayerGamePage finite round sessions', () => {
  it('shows round progress in the HUD, finishes automatically after the final round, and preserves roundsTotal on Play again', async () => {
    const user = userEvent.setup()
    setGameCredentials({ id: 'game-finite', playerToken: 'token-finite' })

    const activeFinalRound = {
      id: 'round-3',
      number: 3,
      scene: {
        biome: 'urban' as const,
        weather: 'clear' as const,
        lighting: 'day' as const,
        temperatureBand: 'mild' as const,
        windBand: 'calm' as const,
        seed: 77,
      },
      startedAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 420_000).toISOString(),
      attemptsUsed: 0,
      attemptsTotal: 3,
      rules: {
        timeLimitSeconds: 420,
        attemptsPerRound: 3,
        selectionMode: 'list' as const,
        countryBorders: true,
        extraData: { mode: 'free' as const },
      },
      selection: null,
      candidates: [{ id: '0', name: 'London', region: 'EUROPE', lat: 51.5074, lon: -0.1278 }],
      extraData: { mode: 'immediate' as const, cost: null, availableAt: null, unlocked: true, pointsSpent: 0 },
    }

    vi.spyOn(api.singleplayer, 'session').mockResolvedValue({
      id: 'game-finite',
      difficulty: 'easy',
      roundsTotal: 3,
      completed: false,
      totalScore: 8000,
      activeRound: activeFinalRound,
      results: [
        {
          roundId: 'round-1',
          number: 1,
          guess: { lat: 48.85, lon: 2.35 },
          actual: { lat: 48.85, lon: 2.35 },
          distanceKm: 0,
          score: 5000,
        },
        {
          roundId: 'round-2',
          number: 2,
          guess: { lat: 40.4, lon: -3.7 },
          actual: { lat: 41.3, lon: 2.1 },
          distanceKm: 500,
          score: 3000,
        },
      ],
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
    vi.spyOn(api.singleplayer, 'selection').mockResolvedValue(undefined)
    vi.spyOn(api.singleplayer, 'guess').mockResolvedValue({
      finalized: true,
      attemptsRemaining: 0,
      result: {
        roundId: 'round-3',
        number: 3,
        guess: { lat: 51.5, lon: -0.12 },
        actual: { lat: 51.5, lon: -0.12 },
        placeName: 'London',
        distanceKm: 0,
        score: 5000,
      },
    })
    const endSpy = vi.spyOn(api.singleplayer, 'end').mockResolvedValue(undefined)
    const createSpy = vi.spyOn(api.singleplayer, 'create').mockResolvedValue({
      id: 'game-finite-2',
      playerToken: 'token-finite-2',
    })

    render(
      <MemoryRouter>
        <SingleplayerGamePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Round 3/)).toBeInTheDocument()
    expect(screen.getByText('/ 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /London/i }))
    await user.click(screen.getByRole('button', { name: 'Final submit' }))

    const resultDialog = await screen.findByRole('dialog', { name: 'Round 3 result' })
    expect(resultDialog).toHaveTextContent('Final round · 3 of 3')
    expect(screen.queryByRole('button', { name: 'Next round' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View summary' }))

    expect(endSpy).toHaveBeenCalledWith({ id: 'game-finite', playerToken: 'token-finite' })
    expect(await screen.findByRole('heading', { name: 'Well explored!' })).toBeInTheDocument()
    expect(screen.getByText('You completed all 3 rounds.')).toBeInTheDocument()
    expect(screen.getByText('3 / 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Play again' }))
    expect(createSpy).toHaveBeenCalledWith('easy', 3)
  })

  it('automatically transitions to the summary when loading an already-completed finite session', async () => {
    setGameCredentials({ id: 'game-done', playerToken: 'token-done' })

    vi.spyOn(api.singleplayer, 'session').mockResolvedValue({
      id: 'game-done',
      difficulty: 'medium',
      roundsTotal: 3,
      completed: true,
      totalScore: 9000,
      activeRound: null,
      results: [
        { roundId: 'r1', number: 1, guess: { lat: 0, lon: 0 }, actual: { lat: 0, lon: 0 }, distanceKm: 0, score: 3000 },
        { roundId: 'r2', number: 2, guess: { lat: 0, lon: 0 }, actual: { lat: 0, lon: 0 }, distanceKm: 0, score: 3000 },
        { roundId: 'r3', number: 3, guess: { lat: 0, lon: 0 }, actual: { lat: 0, lon: 0 }, distanceKm: 0, score: 3000 },
      ],
    })
    const nextSpy = vi.spyOn(api.singleplayer, 'next')
    const endSpy = vi.spyOn(api.singleplayer, 'end').mockResolvedValue(undefined)

    render(
      <MemoryRouter>
        <SingleplayerGamePage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Well explored!' })).toBeInTheDocument()
    expect(screen.getByText('You completed all 3 rounds.')).toBeInTheDocument()
    expect(nextSpy).not.toHaveBeenCalled()
    expect(endSpy).toHaveBeenCalledWith({ id: 'game-done', playerToken: 'token-done' })
  })
})
