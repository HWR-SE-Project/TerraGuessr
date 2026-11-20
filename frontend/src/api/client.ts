// Single entry point for all server I/O. Adds the X-Player-Token header
// (ADR-0011) for owned game/round/result/challenge resources, sends cookies
// for session auth, and translates the backend's error envelope into a typed
// ApiError.
import type { ErrorDTO } from './types'

export const PLAYER_TOKEN_STORAGE_KEY = 'terraguessr.playerToken'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Overrides the token read from localStorage (e.g. right after game creation, or `null` for anonymous entry points). */
  playerToken?: string | null
  /** Lobby membership token (R16), sent as X-Lobby-Token. Omitted when undefined. */
  lobbyToken?: string | null
  signal?: AbortSignal
}

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL
  return configured && configured.length > 0 ? configured : '/api'
}

export function getPlayerToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY)
}

export function setPlayerToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return
  if (!token) {
    localStorage.removeItem(PLAYER_TOKEN_STORAGE_KEY)
    return
  }
  localStorage.setItem(PLAYER_TOKEN_STORAGE_KEY, token)
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '')
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function isErrorDTO(value: unknown): value is ErrorDTO {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const { error } = value as { error: unknown }
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown }
  return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (isErrorDTO(payload)) {
    return new ApiError(payload.error.code, payload.error.message, response.status, payload.error.details)
  }
  return new ApiError(`HTTP_${response.status}`, response.statusText || `Request failed with status ${response.status}`, response.status)
}

/** Fetch wrapper: JSON in/out, cookies + X-Player-Token on every request, ApiError on any non-2xx response. */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, playerToken, lobbyToken, signal } = options
  const token = playerToken === undefined ? getPlayerToken() : playerToken

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['X-Player-Token'] = token
  if (lobbyToken) headers['X-Lobby-Token'] = lobbyToken
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8'

  let response: Response
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    })
  } catch (cause) {
    throw new ApiError('NETWORK_ERROR', cause instanceof Error ? cause.message : 'Network request failed', 0)
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
