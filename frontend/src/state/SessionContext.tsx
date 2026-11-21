import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../api/auth'
import type { AuthConfigResponse, LoginInput, PublicUser, RegisterInput, RegisterResponse, UserPreferences } from '../api/types'
import { ApiError } from '../api/client'

interface SessionState {
  status: 'loading' | 'ready'
  user: PublicUser | null
  preferences: UserPreferences | null
  authConfig: AuthConfigResponse | null
}

interface SessionContextValue extends SessionState {
  refresh: () => Promise<void>
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<RegisterResponse>
  logout: () => Promise<void>
  updateProfile: (displayName: string) => Promise<void>
  updatePreferences: (changes: Partial<Pick<UserPreferences, 'language' | 'soundFxVolume' | 'musicVolume' | 'fullscreen'>>) => Promise<void>
  deleteAccount: (currentPassword?: string) => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    user: null,
    preferences: null,
    authConfig: null,
  })

  const refresh = useCallback(async () => {
    const session = await authApi.fetchSession()
    setState((previous) => ({
      ...previous,
      status: 'ready',
      user: session.user,
      preferences: session.preferences ?? null,
    }))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      const [session, authConfig] = await Promise.allSettled([authApi.fetchSession(), authApi.fetchAuthConfig()])
      if (cancelled) return
      setState({
        status: 'ready',
        user: session.status === 'fulfilled' ? session.value.user : null,
        preferences: session.status === 'fulfilled' ? session.value.preferences ?? null : null,
        authConfig: authConfig.status === 'fulfilled' ? authConfig.value : null,
      })
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    await authApi.login(input)
    await refresh()
  }, [refresh])

  const register = useCallback(async (input: RegisterInput) => {
    const result = await authApi.register(input)
    // Unverified accounts are not signed in until the email link is confirmed;
    // the local/dev fallback returns verificationRequired=false and sets a cookie.
    if (!result.verificationRequired) await refresh()
    return result
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // A logout that 401s because the session already expired client-side
      // still means the user is logged out — don't block on it.
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    setState((previous) => ({ ...previous, user: null, preferences: null }))
  }, [])

  const updateProfile = useCallback(async (displayName: string) => {
    const { user } = await authApi.updateProfile(displayName)
    setState((previous) => ({ ...previous, user }))
  }, [])

  const updatePreferences = useCallback(
    async (changes: Partial<Pick<UserPreferences, 'language' | 'soundFxVolume' | 'musicVolume' | 'fullscreen'>>) => {
      const { preferences } = await authApi.updatePreferences(changes)
      setState((previous) => ({ ...previous, preferences }))
    },
    [],
  )

  const deleteAccount = useCallback(async (currentPassword?: string) => {
    await authApi.deleteAccount('DELETE', currentPassword)
    setState((previous) => ({ ...previous, user: null, preferences: null }))
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, refresh, login, register, logout, updateProfile, updatePreferences, deleteAccount }),
    [state, refresh, login, register, logout, updateProfile, updatePreferences, deleteAccount],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used within a SessionProvider')
  return context
}
