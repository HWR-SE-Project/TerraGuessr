import { apiFetch } from './client'
import type { AuthConfigResponse, LoginInput, PublicUser, RegisterInput, SessionResponse, UserPreferences } from './types'

export function fetchAuthConfig(): Promise<AuthConfigResponse> {
  return apiFetch<AuthConfigResponse>('/auth/config')
}

export function fetchSession(): Promise<SessionResponse> {
  return apiFetch<SessionResponse>('/auth/session')
}

export function register(input: RegisterInput): Promise<{ user: PublicUser }> {
  return apiFetch('/auth/register', { method: 'POST', body: input })
}

export function login(input: LoginInput): Promise<{ user: PublicUser }> {
  return apiFetch('/auth/login', { method: 'POST', body: input })
}

export function logout(): Promise<void> {
  return apiFetch('/auth/logout', { method: 'POST' })
}

export function updateProfile(displayName: string): Promise<{ user: PublicUser }> {
  return apiFetch('/auth/profile', { method: 'PATCH', body: { displayName } })
}

export function updatePreferences(
  changes: Partial<Pick<UserPreferences, 'language' | 'soundFxVolume' | 'musicVolume' | 'fullscreen'>>,
): Promise<{ preferences: UserPreferences }> {
  return apiFetch('/auth/preferences', { method: 'PATCH', body: changes })
}

export function deleteAccount(confirmation: 'DELETE', currentPassword?: string): Promise<void> {
  return apiFetch('/auth/account', { method: 'DELETE', body: { confirmation, currentPassword } })
}

export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiFetch('/auth/password-reset/request', { method: 'POST', body: { email } })
}

export function completePasswordReset(token: string, password: string): Promise<void> {
  return apiFetch('/auth/password-reset/complete', { method: 'POST', body: { token, password } })
}

/** Full-page redirect — not a fetch. The backend completes the OAuth dance and redirects back to appBaseUrl. */
export function googleSignInUrl(): string {
  return '/api/auth/google'
}
