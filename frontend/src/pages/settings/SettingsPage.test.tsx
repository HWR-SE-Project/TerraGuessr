import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const toggleFullscreen = vi.hoisted(() => vi.fn())

vi.mock('../../state/preferences', () => ({
  usePreferences: () => ({
    language: 'en',
    soundFxVolume: 70,
    musicVolume: 50,
    fullscreen: false,
  }),
  toggleFullscreen,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsPage game settings', () => {
  it('shows only game preferences without account controls', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Make it yours' })).toBeInTheDocument()
    const fullscreen = screen.getByRole('switch', { name: 'Fullscreen' })
    expect(fullscreen).toBeVisible()
    fireEvent.click(fullscreen)
    expect(toggleFullscreen).toHaveBeenCalledTimes(1)

    expect(screen.queryByRole('heading', { name: 'Account' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(screen.getByRole('link', { name: 'How your data is used' })).toHaveAttribute('href', '/privacy')
  })
})
