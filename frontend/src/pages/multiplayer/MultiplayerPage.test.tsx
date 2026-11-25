import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../services'
import { initSession, setUser } from '../../state/session'
import { MultiplayerPage } from './MultiplayerPage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('MultiplayerPage display name prefill', () => {
  it('pre-fills the signed-in profile display name and keeps edits across Create and Join tabs', async () => {
    const user = userEvent.setup()
    setUser({
      id: 'user-1',
      email: 'alice@example.com',
      displayName: 'Captain Alice',
      emailVerifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })

    render(
      <MemoryRouter>
        <MultiplayerPage />
      </MemoryRouter>,
    )

    const input = screen.getByLabelText('Your name') as HTMLInputElement
    expect(input.value).toBe('Captain Alice')

    await user.clear(input)
    await user.type(input, 'Alice Explorer')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Alice Explorer')
  })

  it('auto-fills and persists a guest explorer name when not signed in', async () => {
    const user = userEvent.setup()
    vi.spyOn(api.auth, 'getSession').mockResolvedValue({ user: null, preferences: null })
    await initSession({ retries: 0 })

    render(
      <MemoryRouter>
        <MultiplayerPage />
      </MemoryRouter>,
    )

    const input = screen.getByLabelText('Your name') as HTMLInputElement
    expect(input.value.trim().length).toBeGreaterThan(0)
    const generated = input.value
    expect(localStorage.getItem('terraguessr.guestName.v1')).toBe(generated)

    const createSpy = vi.spyOn(api.lobby, 'create').mockResolvedValue({
      lobbyToken: 'token-1',
      lobby: {
        lobbyId: 'lobby-1',
        code: 'AB3C9X',
        difficulty: 'medium',
        status: 'waiting',
        roundsTotal: 5,
        rules: {
          timeLimitSeconds: 240,
          attemptsPerRound: 2,
          selectionMode: 'map',
          countryBorders: true,
          extraData: { mode: 'points', cost: 100 },
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        members: [{ displayName: 'Sunny Fox', isHost: true, isYou: true, joinedAt: new Date().toISOString() }],
        youAreHost: true,
      },
    })

    await user.clear(input)
    await user.type(input, 'Sunny Fox')
    await user.click(screen.getByRole('button', { name: 'Create lobby' }))

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Sunny Fox' }))
    expect(localStorage.getItem('terraguessr.guestName.v1')).toBe('Sunny Fox')
  })
})
