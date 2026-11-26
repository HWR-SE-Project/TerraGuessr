import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services'
import { ResetPasswordPage } from './ResetPasswordPage'
import { RESEND_COOLDOWN_SECONDS } from './useResendCooldown'

const auth = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  completePasswordReset: vi.fn(),
}))

vi.mock('../../services', async () => {
  const actual = await vi.importActual<typeof import('../../services')>('../../services')
  return { ...actual, api: { ...actual.api, auth: { ...actual.api.auth, ...auth } } }
})

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ResetPasswordPage', () => {
  it('shows the Check your email card with a resend cooldown and allows resending once ready', async () => {
    auth.requestPasswordReset.mockResolvedValue({
      message: 'If an email account can be recovered, instructions have been sent.',
    })

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'explorer@example.test' } })
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    fireEvent.click(screen.getByRole('button', { name: 'Send instructions' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    expect(screen.getByText('explorer@example.test')).toBeVisible()
    expect(screen.getByText(/spam or junk folder/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeVisible()
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('explorer@example.test')

    // Starts disabled with 30s countdown right after sending.
    expect(screen.getByRole('button', { name: /Resend recovery email \(30s\)/ })).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000)
    })

    const resendBtn = screen.getByRole('button', { name: 'Resend recovery email' })
    expect(resendBtn).toBeEnabled()
    fireEvent.click(resendBtn)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an email account can be recovered, instructions have been sent.',
    )
    expect(auth.requestPasswordReset).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: /Resend recovery email \(30s\)/ })).toBeDisabled()
  })

  it('syncs the resend cooldown to server Retry-After on 429 errors and allows switching emails', async () => {
    auth.requestPasswordReset
      .mockResolvedValueOnce({
        message: 'If an email account can be recovered, instructions have been sent.',
      })
      .mockRejectedValueOnce(
        new ApiError(
          'RATE_LIMITED',
          'Too many email requests for this address. Please try again in 15 minutes.',
          429,
          undefined,
          900,
        ),
      )

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'explorer@example.test' } })
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    fireEvent.click(screen.getByRole('button', { name: 'Send instructions' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()

    await act(async () => {
      vi.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Resend recovery email' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many email requests for this address. Please try again in 15 minutes.',
    )
    expect(screen.getByRole('button', { name: /Resend recovery email \(15m\)/ })).toBeDisabled()

    // User can go back to edit or try a different email address.
    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }))
    expect(screen.getByLabelText('Email')).toHaveValue('explorer@example.test')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows confirmation after updating password with a token', async () => {
    auth.completePasswordReset.mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'correct horse battery staple' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeVisible()
    expect(auth.completePasswordReset).toHaveBeenCalledWith('valid-token', 'correct horse battery staple')
  })
})
