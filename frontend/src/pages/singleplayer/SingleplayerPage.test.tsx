import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../services'
import { SingleplayerPage } from './SingleplayerPage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SingleplayerPage round count selection', () => {
  it('defaults to 5 fixed rounds matching multiplayer bounds (3..10) and submits the chosen count', async () => {
    const user = userEvent.setup()
    const createSpy = vi.spyOn(api.singleplayer, 'create').mockResolvedValue({
      id: 'game-1',
      playerToken: 'token-1',
    })

    render(
      <MemoryRouter>
        <SingleplayerPage />
      </MemoryRouter>,
    )

    const setRoundsRadio = screen.getByRole('radio', { name: 'Set rounds' })
    const endlessRadio = screen.getByRole('radio', { name: 'Endless' })
    expect(setRoundsRadio).toHaveAttribute('aria-checked', 'true')
    expect(endlessRadio).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Ends automatically after 5 rounds.')).toBeInTheDocument()

    const fewer = screen.getByRole('button', { name: 'Fewer rounds' })
    const more = screen.getByRole('button', { name: 'More rounds' })

    // Lower bound is 3 (matching multiplayer)
    await user.click(fewer)
    await user.click(fewer)
    expect(fewer).toBeDisabled()
    expect(screen.getByText('Ends automatically after 3 rounds.')).toBeInTheDocument()

    // Upper bound is 10 (matching multiplayer)
    for (let i = 0; i < 7; i++) {
      await user.click(more)
    }
    expect(more).toBeDisabled()
    expect(screen.getByText('Ends automatically after 10 rounds.')).toBeInTheDocument()

    // Pick 4 rounds and start
    for (let i = 0; i < 6; i++) {
      await user.click(fewer)
    }
    await user.click(screen.getByRole('button', { name: 'Start exploring' }))

    expect(createSpy).toHaveBeenCalledWith('medium', 4)
    expect(localStorage.getItem('terraguessr.singleplayerRounds.v1')).toBe('4')
  })

  it('allows switching to endless mode and persists the choice across visits', async () => {
    const user = userEvent.setup()
    const createSpy = vi.spyOn(api.singleplayer, 'create').mockResolvedValue({
      id: 'game-2',
      playerToken: 'token-2',
    })

    const { unmount } = render(
      <MemoryRouter>
        <SingleplayerPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('radio', { name: 'Endless' }))
    expect(screen.queryByRole('button', { name: 'Fewer rounds' })).not.toBeInTheDocument()
    expect(screen.getByText('Unlimited')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start exploring' }))
    expect(createSpy).toHaveBeenCalledWith('medium', null)
    expect(localStorage.getItem('terraguessr.singleplayerRounds.v1')).toBe('endless')

    unmount()

    render(
      <MemoryRouter>
        <SingleplayerPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('radio', { name: 'Endless' })).toHaveAttribute('aria-checked', 'true')
  })
})
