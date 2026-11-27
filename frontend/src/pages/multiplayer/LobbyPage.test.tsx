import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../services'
import { clearLobbySession, setLobbySession } from '../../state/lobby'
import { LobbyPage } from './LobbyPage'

beforeEach(() => {
  localStorage.clear()
  clearLobbySession()
})

afterEach(() => {
  cleanup()
  clearLobbySession()
  vi.restoreAllMocks()
})

describe('LobbyPage waiting room capacity', () => {
  it('displays current members out of the server-reported maxMembers', async () => {
    setLobbySession({ code: 'AB3C9X', token: 'token-1', isHost: true })
    vi.spyOn(api.lobby, 'get').mockResolvedValue({
      lobbyId: 'lobby-1',
      code: 'AB3C9X',
      difficulty: 'medium',
      status: 'waiting',
      roundsTotal: 5,
      maxMembers: 16,
      rules: {
        timeLimitSeconds: 240,
        attemptsPerRound: 2,
        selectionMode: 'map',
        countryBorders: true,
        extraData: { mode: 'points', cost: 100 },
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      members: [
        { displayName: 'Host', isHost: true, isYou: true, joinedAt: new Date().toISOString() },
        { displayName: 'Guest', isHost: false, isYou: false, joinedAt: new Date().toISOString() },
      ],
      youAreHost: true,
    })

    render(
      <MemoryRouter initialEntries={['/lobby/AB3C9X']}>
        <Routes>
          <Route path="/lobby/:code" element={<LobbyPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('2 / 16')).toBeInTheDocument()
  })
})
