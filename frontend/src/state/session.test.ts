import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../services/http/client'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
}))

vi.mock('../services', async () => {
  const actual = await vi.importActual<typeof import('../services')>('../services')
  return { ...actual, api: { ...actual.api, auth } }
})

import { initSession, setUser } from './session'
import { renderHook } from '@testing-library/react'
import { useSession } from './session'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('initSession resilience', () => {
  it('keeps an existing authenticated session on transient 5xx / cold-start errors', async () => {
    setUser({
      id: 'u1',
      email: 'player@example.test',
      displayName: 'Explorer',
      emailVerifiedAt: '2026-11-25T00:00:00Z',
      createdAt: '2026-11-25T00:00:00Z',
    })
    auth.getSession.mockRejectedValue(new ApiError('HTTP_504', 'Gateway Timeout', 504))

    await initSession({ retries: 1, retryDelayMs: 1 })

    const { result } = renderHook(() => useSession())
    expect(result.current.status).toBe('authed')
    expect(result.current.user?.id).toBe('u1')
    expect(auth.getSession).toHaveBeenCalledTimes(2)
  })

  it('recovers when a transient 503 succeeds on retry', async () => {
    auth.getSession
      .mockRejectedValueOnce(new ApiError('HTTP_503', 'Service Unavailable', 503))
      .mockResolvedValueOnce({
        user: {
          id: 'u2',
          email: 'retry@example.test',
          displayName: 'Recovered',
          emailVerifiedAt: '2026-11-25T00:00:00Z',
          createdAt: '2026-11-25T00:00:00Z',
        },
        preferences: null,
      })

    await initSession({ retries: 2, retryDelayMs: 1 })

    const { result } = renderHook(() => useSession())
    expect(result.current.status).toBe('authed')
    expect(result.current.user?.displayName).toBe('Recovered')
  })
})
