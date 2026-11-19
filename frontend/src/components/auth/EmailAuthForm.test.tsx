import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'
import { SessionProvider } from '../../state/SessionContext'
import { EmailAuthForm } from './EmailAuthForm'

vi.mock('../../api/auth')

const authConfig = { googleAvailable: false, passwordRecoveryAvailable: true }

function renderForm(onSuccess = vi.fn()) {
  vi.mocked(authApi.fetchSession).mockResolvedValue({ user: null })
  vi.mocked(authApi.fetchAuthConfig).mockResolvedValue(authConfig)
  render(
    <SessionProvider>
      <EmailAuthForm initialMode="register" onSuccess={onSuccess} onForgotPassword={vi.fn()} />
    </SessionProvider>,
  )
  return onSuccess
}

describe('EmailAuthForm', () => {
  afterEach(() => vi.resetAllMocks())

  it('submits registration with the entered fields and calls onSuccess', async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      user: { id: '1', email: 'new@example.com', displayName: 'New Player', emailVerifiedAt: null, createdAt: '2024-01-01' },
    })
    const onSuccess = renderForm()

    await userEvent.type(screen.getByLabelText('Display name'), 'New Player')
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com')
    await userEvent.type(screen.getByLabelText('Password', { exact: false }), 'correct-horse-battery-staple')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(authApi.register).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'correct-horse-battery-staple',
        displayName: 'New Player',
      }),
    )
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('shows a human-readable message when the server rejects with CONFLICT', async () => {
    vi.mocked(authApi.register).mockRejectedValue(new ApiError('CONFLICT', 'duplicate', 409))
    renderForm()

    await userEvent.type(screen.getByLabelText('Display name'), 'New Player')
    await userEvent.type(screen.getByLabelText('Email'), 'dup@example.com')
    await userEvent.type(screen.getByLabelText('Password', { exact: false }), 'correct-horse-battery-staple')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists.')
  })

  it('toggles between register and login mode, clearing display name requirement', async () => {
    renderForm()
    expect(screen.getByLabelText('Display name')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Back to sign in'))

    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('disables the submit button while a submission is in flight', async () => {
    let resolveLogin: (value: { user: never }) => void = () => {}
    vi.mocked(authApi.login).mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve
      }) as ReturnType<typeof authApi.login>,
    )
    renderForm()

    await userEvent.click(screen.getByText('Back to sign in'))
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password', { exact: false }), 'correct-horse-battery-staple')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled()

    resolveLogin!({ user: undefined as never })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).not.toBeDisabled())
  })
})
