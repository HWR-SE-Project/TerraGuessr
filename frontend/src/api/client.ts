// Single entry point for all server I/O (IMPLEMENTATION-RULES §2).
// Adds the X-Player-Token header (ADR-0011) and translates the ADR-0009 error
// envelope into a typed ApiError.
import type { ErrorDTO } from './types';

export const PLAYER_TOKEN_STORAGE_KEY = 'terraguessr.playerToken';

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_TILE_URL?: string;
    readonly VITE_MAP_ATTRIBUTION?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

/** Typed failure parsed from the ADR-0009 error envelope. */
export class ApiError extends Error {
  readonly code: string;

  readonly status: number;

  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Overrides the token read from localStorage (e.g. right after game creation). */
  playerToken?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  return configured && configured.length > 0 ? configured : '/api';
}

export function getPlayerToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY);
}

export function setPlayerToken(token: string | null): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (token === null || token.length === 0) {
    localStorage.removeItem(PLAYER_TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(PLAYER_TOKEN_STORAGE_KEY, token);
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function isErrorDTO(value: unknown): value is ErrorDTO {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const { error } = value as { error: unknown };
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown };
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (isErrorDTO(payload)) {
    return new ApiError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.details,
    );
  }

  return new ApiError(
    `HTTP_${response.status}`,
    response.statusText || `Request failed with status ${response.status}`,
    response.status,
  );
}

/**
 * Fetch wrapper: JSON in/out, X-Player-Token on every request, ApiError on any
 * non-2xx response. 204 responses resolve to `undefined`.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, playerToken, headers = {}, signal } = options;
  const token = playerToken === undefined ? getPlayerToken() : playerToken;

  const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  if (token) {
    requestHeaders['X-Player-Token'] = token;
  }
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json; charset=utf-8';
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  } catch (cause) {
    throw new ApiError(
      'NETWORK_ERROR',
      cause instanceof Error ? cause.message : 'Network request failed',
      0,
    );
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
