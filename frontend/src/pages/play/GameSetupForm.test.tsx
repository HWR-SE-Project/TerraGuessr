import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameSetupForm } from './GameSetupForm'

describe('weather expedition setup follows the existing server difficulty policy', () => {
  it.each([
    ['Easy', 'list', 'Click the map'],
    ['Hard', 'map', 'Pick from a list'],
  ] as const)(
    '%s explains and submits the supported selection mode',
    async (label, selectionMode, disabledLabel) => {
      const onStart = vi.fn()
      render(
        <GameSetupForm onStart={onStart} submitting={false} error={null} />,
      )
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: label }))
      expect(screen.getByRole('button', { name: disabledLabel })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Start playing' }))
      expect(onStart).toHaveBeenCalledWith(
        expect.objectContaining({
          difficulty: label.toLowerCase(),
          selectionMode,
        }),
      )
    },
  )

  it('Medium preserves the player’s choice', async () => {
    const onStart = vi.fn()
    render(<GameSetupForm onStart={onStart} submitting={false} error={null} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Pick from a list' }))
    await user.click(screen.getByRole('button', { name: 'Start playing' }))
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: 'medium', selectionMode: 'list' }),
    )
  })
})
