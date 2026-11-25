import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'
import { useSession } from '../../state/session'

const auth = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  getSession: vi.fn(),
  resendVerification: vi.fn(),
}))

vi.mock('../../services', async () => {
  const actual = await vi.importActual<typeof import('../../services')>('../../services')
  return { ...actual, api: { ...actual.api, auth } }
})

function SessionProbe() {
  const session = useSession()
  return <span data-testid="session-status">{session.status}</span>
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('AuthPage registration verification flow', () => {
  it('does not establish an authenticated session when email verification is required', async () => {
    auth.register.mockResolvedValue({
      user: {
        id: 'u1',
        email: 'new@example.test',
        displayName: 'Explorer',
        emailVerifiedAt: null,
        createdAt: '2026-11-25T00:00:00Z',
      },
      verificationRequired: true,
    })
    auth.resendVerification.mockResolvedValue({
      message: 'If an account needs verification, a new email has been sent.',
    })

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <SessionProbe />
        <AuthPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: "Don't have an account? Sign up" }))
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Explorer' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    expect(screen.getByText(/spam or junk folder/i)).toBeVisible()
    expect(screen.getByTestId('session-status')).toHaveTextContent('guest')
    expect(auth.getSession).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))
    expect(await screen.findByRole('status')).toHaveTextContent('If an account needs verification')
    expect(auth.resendVerification).toHaveBeenCalledWith('new@example.test')
  })
})
