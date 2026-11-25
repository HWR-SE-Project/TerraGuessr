// Mock authentication service. Mirrors the backend auth routes (see
// backend/src/modules/auth/routes.ts) but persists to localStorage so the demo
// survives a reload. Every function returns the same shape the real API would.

import type {
  AuthConfig,
  AvatarConfig,
  PublicUser,
  RegisterInput,
  RegisterResponse,
  SessionResponse,
  UserPreferences,
} from '../../lib/contracts'
import { DEFAULT_AVATAR, normalizeEmail, nowIso, toPublicUser } from './db'
import type { MockUserPreferences } from './db'

const USERS_KEY = 'terraguessr.mock.users.v1'
const CURRENT_KEY = 'terraguessr.mock.current.v1'
const PREFS_KEY = 'terraguessr.mock.preferences.v1'
const AVATAR_KEY = 'terraguessr.mock.avatar.v1'

interface StoredUser {
  id: string
  email: string
  password: string
  displayName: string
  emailVerifiedAt: string | null
  createdAt: string
  hasPassword: boolean
  hasGoogle: boolean
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — keep in-memory */
  }
}

const users: StoredUser[] = read<StoredUser[]>(USERS_KEY, [])
const prefs: Record<string, MockUserPreferences> = read(PREFS_KEY, {})
const avatars: Record<string, AvatarConfig> = read(AVATAR_KEY, {})

let currentId: string | null = read<string | null>(CURRENT_KEY, null)

function persist() {
  write(USERS_KEY, users)
  write(CURRENT_KEY, currentId)
  write(PREFS_KEY, prefs)
  write(AVATAR_KEY, avatars)
}

function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function findUser(id: string): StoredUser | undefined {
  return users.find((user) => user.id === id)
}

function currentUser(): PublicUser | null {
  if (!currentId) return null
  const user = findUser(currentId)
  return user ? toPublicUser(user) : null
}

function currentPreferences(): UserPreferences | null {
  const user = currentUser()
  if (!user) return null
  const value = prefs[user.id] ?? {
    language: 'en',
    soundFxVolume: 70,
    musicVolume: 50,
    fullscreen: false,
    avatarConfig: null,
  }
  return {
    userId: user.id,
    language: value.language,
    soundFxVolume: value.soundFxVolume,
    musicVolume: value.musicVolume,
    fullscreen: value.fullscreen,
  }
}

export const authMock = {
  getConfig(): Promise<AuthConfig> {
    return delay({
      googleAvailable: false,
      passwordRecoveryAvailable: true,
      emailVerificationAvailable: false,
    })
  },

  getGoogleAuthUrl(): string {
    return '/api/auth/google'
  },

  getSession(): Promise<SessionResponse> {
    return delay({ user: currentUser(), preferences: currentPreferences() })
  },

  register(input: RegisterInput): Promise<RegisterResponse> {
    const email = normalizeEmail(input.email)
    if (users.some((user) => user.email === email)) {
      return Promise.reject(
        Object.assign(new Error('An account with this email already exists.'), {
          code: 'EMAIL_TAKEN',
          status: 409,
        }),
      )
    }
    const user: StoredUser = {
      id: `u_${Math.random().toString(36).slice(2, 10)}`,
      email,
      password: input.password,
      displayName: input.displayName.trim(),
      // Mock auto-verifies so the demo can play immediately.
      emailVerifiedAt: nowIso(),
      createdAt: nowIso(),
      hasPassword: true,
      hasGoogle: false,
    }
    users.push(user)
    currentId = user.id
    prefs[user.id] = {
      language: 'en',
      soundFxVolume: 70,
      musicVolume: 50,
      fullscreen: false,
      avatarConfig: null,
    }
    avatars[user.id] = { ...DEFAULT_AVATAR }
    persist()
    return delay({ user: toPublicUser(user), verificationRequired: false })
  },

  login(input: { email: string; password: string }): Promise<{ user: PublicUser }> {
    const email = normalizeEmail(input.email)
    const user = users.find((candidate) => candidate.email === email)
    if (!user || user.password !== input.password) {
      return Promise.reject(
        Object.assign(new Error('Email or password is incorrect.'), {
          code: 'INVALID_CREDENTIALS',
          status: 401,
        }),
      )
    }
    currentId = user.id
    persist()
    return delay({ user: toPublicUser(user) })
  },

  logout(): Promise<void> {
    currentId = null
    persist()
    return delay(undefined)
  },

  verifyEmail(token: string): Promise<{ verified: boolean; user: PublicUser }> {
    const user = users.find((candidate) => candidate.id === token)
    if (!user) {
      return Promise.reject(
        Object.assign(new Error('This verification link is invalid or expired.'), {
          code: 'INVALID_TOKEN',
          status: 400,
        }),
      )
    }
    user.emailVerifiedAt = nowIso()
    persist()
    return delay({ verified: true, user: toPublicUser(user) })
  },

  resendVerification(_email: string): Promise<{ message: string }> {
    return delay({ message: 'If an account needs verification, a new email has been sent.' })
  },

  requestPasswordReset(_email: string): Promise<{ message: string }> {
    return delay({ message: 'If an email account can be recovered, instructions have been sent.' })
  },

  completePasswordReset(token: string, password: string): Promise<void> {
    // Mock accepts any token; in Phase 2 the backend validates a real one.
    const user = users.find((candidate) => candidate.id === token) ?? users[0]
    if (!user) {
      return Promise.reject(
        Object.assign(new Error('This reset link is invalid or expired.'), {
          code: 'INVALID_TOKEN',
          status: 400,
        }),
      )
    }
    user.password = password
    persist()
    return delay(undefined)
  },

  updateProfile(displayName: string): Promise<{ user: PublicUser }> {
    const user = findUser(currentId ?? '')
    if (!user) {
      return Promise.reject(Object.assign(new Error('Not signed in.'), { code: 'UNAUTHENTICATED', status: 401 }))
    }
    user.displayName = displayName.trim()
    persist()
    return delay({ user: toPublicUser(user) })
  },

  requestEmailChange(newEmail: string, _currentPassword?: string): Promise<{ message: string; pendingEmail: string }> {
    const user = findUser(currentId ?? '')
    if (!user) {
      return Promise.reject(Object.assign(new Error('Not signed in.'), { code: 'UNAUTHENTICATED', status: 401 }))
    }
    return delay({ message: 'Check your current and new inboxes to confirm the change.', pendingEmail: newEmail })
  },

  confirmEmailChange(_token: string): Promise<{ side: 'old' | 'new'; changed: boolean; email?: string; pending: 'old' | 'new' | null }> {
    const user = findUser(currentId ?? '')
    if (!user) {
      return Promise.reject(Object.assign(new Error('This confirmation link is invalid or expired.'), { code: 'INVALID_TOKEN', status: 400 }))
    }
    return delay({ side: 'new', changed: true, email: user.email, pending: null })
  },

  updatePreferences(
    changes: Partial<Pick<UserPreferences, 'language' | 'soundFxVolume' | 'musicVolume' | 'fullscreen'>>,
  ): Promise<{ preferences: UserPreferences }> {
    const user = currentUser()
    if (!user) {
      return Promise.reject(Object.assign(new Error('Not signed in.'), { code: 'UNAUTHENTICATED', status: 401 }))
    }
    const current = prefs[user.id] ?? {
      language: 'en',
      soundFxVolume: 70,
      musicVolume: 50,
      fullscreen: false,
      avatarConfig: avatars[user.id] ?? null,
    }
    prefs[user.id] = { ...current, ...changes }
    persist()
    return delay({ preferences: currentPreferences()! })
  },

  getAvatar(): Promise<{ avatarConfig: AvatarConfig | null }> {
    const user = currentUser()
    return delay({ avatarConfig: user ? (avatars[user.id] ?? { ...DEFAULT_AVATAR }) : null })
  },

  saveAvatar(config: AvatarConfig): Promise<{ avatarConfig: AvatarConfig }> {
    const user = currentUser()
    if (!user) {
      return Promise.reject(Object.assign(new Error('Not signed in.'), { code: 'UNAUTHENTICATED', status: 401 }))
    }
    avatars[user.id] = config
    persist()
    return delay({ avatarConfig: config })
  },

  deleteAccount(confirmation: 'DELETE', currentPassword?: string): Promise<void> {
    const user = findUser(currentId ?? '')
    if (!user) {
      return Promise.reject(Object.assign(new Error('Not signed in.'), { code: 'UNAUTHENTICATED', status: 401 }))
    }
    if (currentPassword && user.password !== currentPassword) {
      return Promise.reject(
        Object.assign(new Error('Current password is incorrect.'), { code: 'INVALID_CREDENTIALS', status: 401 }),
      )
    }
    if (confirmation !== 'DELETE') {
      return Promise.reject(Object.assign(new Error('Type DELETE to confirm.'), { code: 'INVALID_CONFIRMATION', status: 400 }))
    }
    const index = users.findIndex((candidate) => candidate.id === user.id)
    users.splice(index, 1)
    delete prefs[user.id]
    delete avatars[user.id]
    currentId = null
    persist()
    return delay(undefined)
  },
}

export function resetMockAuth(): void {
  users.splice(0)
  currentId = null
  persist()
}
