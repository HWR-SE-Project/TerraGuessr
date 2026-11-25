import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from './AccountPage'
import type { PublicUser } from '../../lib/contracts'

const mockSession = vi.hoisted(() => ({
  status: 'authed' as 'loading' | 'guest' | 'authed',
  user: null as PublicUser | null,
  preferences: null,
}))

vi.mock('../../state/session', () => ({
  useSession: () => mockSession,
  signOut: vi.fn(),
  setUser: vi.fn(),
}))

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  mockSession.status = 'authed'
  mockSession.user = null
})

describe('AccountPage controls', () => {
  it('marks email as Managed by Google and hides password confirmation for Google-only users', () => {
    mockSession.user = {
      id: 'u-google',
      email: 'explorer@gmail.com',
      displayName: 'Explorer',
      emailVerifiedAt: '2026-11-25T00:00:00Z',
      createdAt: '2026-11-25T00:00:00Z',
      hasPassword: false,
      hasGoogle: true,
    }

    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('explorer@gmail.com')).toBeVisible()
    expect(screen.getByText('Managed by Google')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Current password (if set)')).toBeNull()
  })

  it('allows changing email and shows password confirmation for email/password users', () => {
    mockSession.user = {
      id: 'u-email',
      email: 'explorer@example.test',
      displayName: 'Explorer',
      emailVerifiedAt: '2026-11-25T00:00:00Z',
      createdAt: '2026-11-25T00:00:00Z',
      hasPassword: true,
      hasGoogle: false,
    }

    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Change' })).toBeVisible()
    expect(screen.queryByText('Managed by Google')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Current password (if set)')).toBeInTheDocument()
  })

  it('prompts guests to sign in', () => {
    mockSession.status = 'guest'
    mockSession.user = null

    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth')
  })
})
