import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailChangePage } from './EmailChangePage'
import { VerifyEmailPage } from './VerifyEmailPage'

const auth = vi.hoisted(() => ({ verifyEmail: vi.fn(), confirmEmailChange: vi.fn() }))
vi.mock('../../services', () => ({ api: { auth } }))

beforeEach(() => vi.resetAllMocks())

describe('email confirmation links', () => {
  it('verifies a token just once under Strict Mode', async () => {
    auth.verifyEmail.mockResolvedValue({ verified: true })
    render(<StrictMode><MemoryRouter initialEntries={['/verify-email?token=proof']}><VerifyEmailPage /></MemoryRouter></StrictMode>)

    expect(await screen.findByText('Your email is verified. Welcome aboard!')).toBeVisible()
    expect(auth.verifyEmail).toHaveBeenCalledTimes(1)
    expect(auth.verifyEmail).toHaveBeenCalledWith('proof')
  })

  it('confirms an email change just once and reports the resulting address', async () => {
    auth.confirmEmailChange.mockResolvedValue({ changed: true, email: 'updated@example.test' })
    render(<StrictMode><MemoryRouter initialEntries={['/confirm-email-change?token=proof']}><EmailChangePage /></MemoryRouter></StrictMode>)

    expect(await screen.findByText('Your email is now updated@example.test.')).toBeVisible()
    expect(auth.confirmEmailChange).toHaveBeenCalledTimes(1)
    expect(auth.confirmEmailChange).toHaveBeenCalledWith('proof')
  })

  it('renders a missing token error without sending a request', () => {
    render(<MemoryRouter initialEntries={['/verify-email']}><VerifyEmailPage /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('missing a token')
    expect(auth.verifyEmail).not.toHaveBeenCalled()
  })

  it('ignores an earlier token response after navigating to another token', async () => {
    let rejectFirst!: (error: Error) => void
    auth.verifyEmail.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject }))
    auth.verifyEmail.mockResolvedValueOnce({ verified: true })
    render(
      <MemoryRouter initialEntries={['/verify-email?token=first']}>
        <Link to="/verify-email?token=second">Use another link</Link>
        <VerifyEmailPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Use another link' }))
    expect(await screen.findByText('Your email is verified. Welcome aboard!')).toBeVisible()
    await act(async () => { rejectFirst(new Error('Old link is expired')) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Your email is verified.')
  })
})
