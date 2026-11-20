import { apiFetch } from './client'
import type {
  AuthConfigResponse,
  EmailChangeConfirmation,
  EmailChangeRequestResponse,
  LoginInput,
  PublicUser,
  RegisterInput,
  RegisterResponse,
  SessionResponse,
  UserPreferences,
} from './types'

export function fetchAuthConfig(): Promise<AuthConfigResponse> {
  return apiFetch<AuthConfigResponse>('/auth/config')
}

export function fetchSession(): Promise<SessionResponse> {
  return apiFetch<SessionResponse>('/auth/session')
}

export function register(input: RegisterInput): Promise<RegisterResponse> {
  return apiFetch('/auth/register', { method: 'POST', body: input })
}

export function verifyEmail(token: string): Promise<{ verified: boolean; user: PublicUser }> {
  return apiFetch('/auth/verify-email', { method: 'POST', body: { token } })
}

export function resendVerification(email: string): Promise<{ message: string }> {
  return apiFetch('/auth/verification/resend', { method: 'POST', body: { email } })
}

export function login(input: LoginInput): Promise<{ user: PublicUser }> {
  return apiFetch('/auth/login', { method: 'POST', body: input })
}

export function logout(): Promise<void> {
  return apiFetch('/auth/logout', { method: 'POST' })
}

export function requestEmailChange(
  newEmail: string,
  currentPassword?: string,
): Promise<EmailChangeRequestResponse> {
  return apiFetch('/auth/email-change/request', {
    method: 'POST',
    body: { newEmail, currentPassword },
  })
}

export function confirmEmailChange(token: string): Promise<EmailChangeConfirmation> {
  return apiFetch('/auth/email-change/confirm', { method: 'POST', body: { token } })
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
