// Single entry point for all server I/O. Sends cookies for session auth and
// an explicit X-Player-Token/X-Lobby-Token per call (callers already hold
// these via state/game.ts and state/lobby.ts), and translates the backend's
// error envelope into a typed ApiError.

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: Record<string, unknown>
  readonly retryAfterSeconds?: number

  constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
    retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  playerToken?: string | null
  /** Lobby membership token (R16), sent as X-Lobby-Token. */
  lobbyToken?: string | null
  signal?: AbortSignal
  /** Best-effort keepalive for unload-time cleanup requests. */
  keepalive?: boolean
}

interface ErrorDTO {
  error: { code: string; message: string; details?: Record<string, unknown> }
}

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL
  return configured && configured.length > 0 ? configured : '/api'
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '')
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function isErrorDTO(value: unknown): value is ErrorDTO {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const { error } = value as { error: unknown }
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; message?: unknown }
  return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}

function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined
  const trimmed = header.trim()
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed)
    return seconds > 0 ? seconds : undefined
  }
  const timestamp = Date.parse(trimmed)
  if (!Number.isNaN(timestamp)) {
    const seconds = Math.ceil((timestamp - Date.now()) / 1000)
    return seconds > 0 ? seconds : undefined
  }
  return undefined
}

function formatRetryWait(seconds: number): string {
  const safe = Math.max(1, Math.ceil(seconds))
  if (safe < 60) return `${safe} second${safe === 1 ? '' : 's'}`
  const minutes = Math.ceil(safe / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

async function toApiError(response: Response): Promise<ApiError> {
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'))
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (isErrorDTO(payload)) {
    const message =
      response.status === 429 &&
      retryAfterSeconds !== undefined &&
      payload.error.message.trim().toLowerCase() === 'too many requests'
        ? `Too many requests. Please try again in ${formatRetryWait(retryAfterSeconds)}.`
        : payload.error.message
    return new ApiError(
      payload.error.code,
      message,
      response.status,
      payload.error.details,
      retryAfterSeconds,
    )
  }
  return new ApiError(
    `HTTP_${response.status}`,
    response.statusText || `Request failed with status ${response.status}`,
    response.status,
    undefined,
    retryAfterSeconds,
  )
}

/** Fetch wrapper: JSON in/out, cookies + X-Player-Token/X-Lobby-Token, ApiError on any non-2xx response. */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, playerToken, lobbyToken, signal, keepalive } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (playerToken) headers['X-Player-Token'] = playerToken
  if (lobbyToken) headers['X-Lobby-Token'] = lobbyToken
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8'

  let response: Response
  try {
    response = await fetch(buildApiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
      keepalive,
    })
  } catch (cause) {
    throw new ApiError('NETWORK_ERROR', cause instanceof Error ? cause.message : 'Network request failed', 0)
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
