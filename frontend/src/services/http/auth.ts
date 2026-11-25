// Real auth service. Same method names/shapes as services/mock/auth.ts,
// backed by backend/src/modules/auth/routes.ts.

import type {
  AuthConfig,
  AvatarConfig,
  PublicUser,
  RegisterInput,
  RegisterResponse,
  SessionResponse,
  UserPreferences,
} from '../../lib/contracts'
import { apiFetch, buildApiUrl } from './client'

export const authHttp = {
  getConfig(): Promise<AuthConfig> {
    return apiFetch<AuthConfig>('/auth/config')
  },

  getGoogleAuthUrl(): string {
    return buildApiUrl('/auth/google')
  },

  getSession(): Promise<SessionResponse> {
    return apiFetch<SessionResponse>('/auth/session')
  },

  register(input: RegisterInput): Promise<RegisterResponse> {
    return apiFetch('/auth/register', { method: 'POST', body: input })
  },

  login(input: { email: string; password: string }): Promise<{ user: PublicUser }> {
    return apiFetch('/auth/login', { method: 'POST', body: input })
  },

  logout(): Promise<void> {
    return apiFetch('/auth/logout', { method: 'POST' })
  },

  verifyEmail(token: string): Promise<{ verified: boolean; user: PublicUser }> {
    return apiFetch('/auth/verify-email', { method: 'POST', body: { token } })
  },

  resendVerification(email: string): Promise<{ message: string }> {
    return apiFetch('/auth/verification/resend', { method: 'POST', body: { email } })
  },

  requestPasswordReset(email: string): Promise<{ message: string }> {
    return apiFetch('/auth/password-reset/request', { method: 'POST', body: { email } })
  },

  completePasswordReset(token: string, password: string): Promise<void> {
    return apiFetch('/auth/password-reset/complete', { method: 'POST', body: { token, password } })
  },

  updateProfile(displayName: string): Promise<{ user: PublicUser }> {
    return apiFetch('/auth/profile', { method: 'PATCH', body: { displayName } })
  },

  requestEmailChange(
    newEmail: string,
    currentPassword?: string,
  ): Promise<{ message: string; pendingEmail: string }> {
    return apiFetch('/auth/email-change/request', {
      method: 'POST',
      body: { newEmail, currentPassword },
    })
  },

  confirmEmailChange(
    token: string,
  ): Promise<{ side: 'old' | 'new'; changed: boolean; email?: string; pending: 'old' | 'new' | null }> {
    return apiFetch('/auth/email-change/confirm', { method: 'POST', body: { token } })
  },

  updatePreferences(
    changes: Partial<Pick<UserPreferences, 'language' | 'soundFxVolume' | 'musicVolume' | 'fullscreen'>>,
  ): Promise<{ preferences: UserPreferences }> {
    return apiFetch('/auth/preferences', { method: 'PATCH', body: changes })
  },

  getAvatar(): Promise<{ avatarConfig: AvatarConfig | null }> {
    return apiFetch('/auth/avatar')
  },

  saveAvatar(config: AvatarConfig): Promise<{ avatarConfig: AvatarConfig }> {
    return apiFetch('/auth/avatar', { method: 'PATCH', body: config })
  },

  deleteAccount(confirmation: 'DELETE', currentPassword?: string): Promise<void> {
    return apiFetch('/auth/account', { method: 'DELETE', body: { confirmation, currentPassword } })
  },
}
