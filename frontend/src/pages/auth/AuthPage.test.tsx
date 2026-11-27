import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'
import { useSession } from '../../state/session'
import { RESEND_COOLDOWN_SECONDS } from './useResendCooldown'

const auth = vi.hoisted(() => ({
  getConfig: vi.fn(),
  getGoogleAuthUrl: vi.fn(),
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
  auth.getConfig.mockResolvedValue({
    googleAvailable: false,
    passwordRecoveryAvailable: false,
    emailVerificationAvailable: false,
  })
  auth.getGoogleAuthUrl.mockReturnValue('/api/auth/google')
})

afterEach(() => {
  vi.useRealTimers()
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
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    expect(screen.getByText(/spam or junk folder/i)).toBeVisible()
    expect(screen.getByTestId('session-status')).toHaveTextContent('guest')
    expect(auth.getSession).not.toHaveBeenCalled()

    // Resend starts in cooldown right after registration sends the initial email.
    const coolingBtn = screen.getByRole('button', { name: /Resend verification email \(30s\)/ })
    expect(coolingBtn).toBeDisabled()
    await waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0))

    await act(async () => {
      vi.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000)
    })

    const resendBtn = screen.getByRole('button', { name: 'Resend verification email' })
    expect(resendBtn).toBeEnabled()
    fireEvent.click(resendBtn)

    expect(await screen.findByRole('status')).toBeVisible()
    expect(auth.resendVerification).toHaveBeenCalledWith('new@example.test')
    expect(screen.getByRole('button', { name: /Resend verification email \(30s\)/ })).toBeDisabled()
  })
})

describe('AuthPage Google sign-in', () => {
  it('enables Continue with Google when backend reports googleAvailable and navigates on click', async () => {
    auth.getConfig.mockResolvedValue({
      googleAvailable: true,
      passwordRecoveryAvailable: true,
      emailVerificationAvailable: true,
    })
    const assign = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign },
    })

    try {
      render(
        <MemoryRouter initialEntries={['/auth']}>
          <AuthPage />
        </MemoryRouter>,
      )

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      await waitFor(() => expect(googleButton).toBeEnabled())

      fireEvent.click(googleButton)
      expect(assign).toHaveBeenCalledWith('/api/auth/google')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })

  it('keeps Continue with Google disabled when Google sign-in is not configured', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AuthPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(auth.getConfig).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled()
  })

  it('displays a friendly alert for known Google OAuth redirect errors and ignores unknown codes', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/auth?authError=google_email_exists']}>
        <AuthPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /an account with this email already exists/i,
    )
    unmount()

    render(
      <MemoryRouter initialEntries={['/auth?authError=untrusted_payload']}>
        <AuthPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(auth.getConfig).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('opens the data usage summary dialog without navigating away from the form', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AuthPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(auth.getConfig).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'explorer@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'How your data is used' }))

    expect(screen.getByRole('dialog', { name: 'How your data is used' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open full page' })).toHaveAttribute('href', '/privacy')

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.getByLabelText('Email')).toHaveValue('explorer@example.test')
  })
})
