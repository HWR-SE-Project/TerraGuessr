import { afterEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_TOKEN_STORAGE_KEY, apiFetch, getPlayerToken, setPlayerToken } from './client'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('resolves with parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })))
    await expect(apiFetch<{ ok: boolean }>('/ping')).resolves.toEqual({ ok: true })
  })

  it('returns undefined for a 204 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(apiFetch('/noop')).resolves.toBeUndefined()
  })

  it('throws a typed ApiError built from the backend error envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: 'CONFLICT', message: 'Already exists' } }, 409)),
    )
    await expect(apiFetch('/thing')).rejects.toMatchObject({ code: 'CONFLICT', message: 'Already exists', status: 409 })
  })

  it('falls back to an HTTP_<status> code when the body is not the error envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500, statusText: 'Internal Server Error' })))
    await expect(apiFetch('/thing')).rejects.toMatchObject({ code: 'HTTP_500', status: 500 })
  })

  it('wraps a fetch failure as a NETWORK_ERROR with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(apiFetch('/thing')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 })
  })

  it('sends the stored player token as X-Player-Token', async () => {
    setPlayerToken('tok-123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    await apiFetch('/thing')
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>)['X-Player-Token']).toBe('tok-123')
    expect(init.credentials).toBe('include')
  })

  it('omits the player token header when explicitly overridden with null', async () => {
    setPlayerToken('tok-123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    await apiFetch('/thing', { playerToken: null })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>)['X-Player-Token']).toBeUndefined()
  })

  it('sends a lobby token as X-Lobby-Token without touching the player token', async () => {
    setPlayerToken('game-token')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    await apiFetch('/lobbies/ABC234', { lobbyToken: 'lobby-token' })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['X-Lobby-Token']).toBe('lobby-token')
    expect(headers['X-Player-Token']).toBe('game-token')
  })

  it('omits the lobby token header when it is not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    await apiFetch('/lobbies/ABC234')
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>)['X-Lobby-Token']).toBeUndefined()
  })
})

describe('player token storage', () => {
  afterEach(() => localStorage.clear())

  it('round-trips through localStorage', () => {
    expect(getPlayerToken()).toBeNull()
    setPlayerToken('abc')
    expect(getPlayerToken()).toBe('abc')
    expect(localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY)).toBe('abc')
    setPlayerToken(null)
    expect(getPlayerToken()).toBeNull()
  })
})
