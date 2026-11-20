import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../api/auth'
import { ApiError } from '../api/client'
import type { PublicUser } from '../api/types'
import { SessionProvider, useSession } from './SessionContext'

vi.mock('../api/auth')

const user: PublicUser = { id: '1', email: 'a@b.com', displayName: 'Ada', emailVerifiedAt: null, createdAt: '2024-01-01' }
const authConfig = { googleAvailable: false, passwordRecoveryAvailable: false, emailVerificationAvailable: false }

function Probe() {
  const session = useSession()
  return (
    <div>
      <span data-testid="status">{session.status}</span>
      <span data-testid="user">{session.user?.displayName ?? 'none'}</span>
      <button onClick={() => session.login({ email: 'a@b.com', password: 'correct-horse-battery-staple' })}>login</button>
      <button onClick={() => session.logout().catch(() => {})}>logout</button>
    </div>
  )
}

describe('SessionProvider', () => {
  afterEach(() => vi.resetAllMocks())

  it('bootstraps as logged-out when there is no active session', async () => {
    vi.mocked(authApi.fetchSession).mockResolvedValue({ user: null })
    vi.mocked(authApi.fetchAuthConfig).mockResolvedValue(authConfig)

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('logs in and reflects the refreshed session', async () => {
    vi.mocked(authApi.fetchSession)
      .mockResolvedValueOnce({ user: null })
      .mockResolvedValue({ user, dailyStreak: { current: 2, longest: 5 } })
    vi.mocked(authApi.fetchAuthConfig).mockResolvedValue(authConfig)
    vi.mocked(authApi.login).mockResolvedValue({ user })

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))

    await userEvent.click(screen.getByText('login'))

    expect(authApi.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'correct-horse-battery-staple' })
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Ada'))
  })

  it('treats a 401 on logout as already-logged-out instead of throwing', async () => {
    vi.mocked(authApi.fetchSession).mockResolvedValue({ user })
    vi.mocked(authApi.fetchAuthConfig).mockResolvedValue(authConfig)
    vi.mocked(authApi.logout).mockRejectedValue(new ApiError('UNAUTHORIZED', 'expired', 401))

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Ada'))

    await userEvent.click(screen.getByText('logout'))

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'))
  })

  it('propagates a non-401 logout failure instead of silently clearing the session', async () => {
    vi.mocked(authApi.fetchSession).mockResolvedValue({ user })
    vi.mocked(authApi.fetchAuthConfig).mockResolvedValue(authConfig)
    vi.mocked(authApi.logout).mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline', 0))

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Ada'))

    await userEvent.click(screen.getByText('logout'))

    // Still logged in — the failed logout must not have cleared local state.
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Ada'))
  })
})
