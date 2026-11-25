import { api, ApiError } from '../services'
import { createStore, useStore, type Store } from '../lib/store'
import type { PublicUser, RegisterResponse, UserPreferences } from '../lib/contracts'

export type SessionStatus = 'loading' | 'guest' | 'authed'

interface SessionState {
  status: SessionStatus
  user: PublicUser | null
  preferences: UserPreferences | null
}

const store: Store<SessionState> =
  (import.meta.hot?.data?.sessionStore as Store<SessionState> | undefined) ??
  createStore<SessionState>({
    status: 'loading',
    user: null,
    preferences: null,
  })

if (import.meta.hot) {
  import.meta.hot.dispose((data: Record<string, unknown>) => {
    data.sessionStore = store
  })
}

let inFlightInit: Promise<void> | null = null

function isTransientError(cause: unknown): boolean {
  if (!(cause instanceof ApiError)) return true
  return cause.status === 0 || cause.status >= 500
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useSession(): SessionState {
  return useStore(store)
}

export async function initSession(options: { retries?: number; retryDelayMs?: number } = {}): Promise<void> {
  if (inFlightInit) return inFlightInit
  const retries = options.retries ?? 2
  const retryDelayMs = options.retryDelayMs ?? 1500

  inFlightInit = (async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const session = await api.auth.getSession()
        store.set({
          status: session.user ? 'authed' : 'guest',
          user: session.user,
          preferences: session.preferences ?? null,
        })
        return
      } catch (cause) {
        if (attempt < retries && isTransientError(cause)) {
          await wait(retryDelayMs)
          continue
        }
        // Never wipe an already-authenticated UI session on a transient 5xx /
        // cold-start timeout; only fall back to guest during initial boot.
        if (store.get().status === 'loading' || !isTransientError(cause)) {
          store.set({ status: 'guest', user: null, preferences: null })
        }
        return
      }
    }
  })().finally(() => {
    inFlightInit = null
  })

  return inFlightInit
}

export async function signIn(email: string, password: string): Promise<PublicUser> {
  const { user } = await api.auth.login({ email, password })
  const { preferences } = await api.auth.getSession()
  store.set({ status: 'authed', user, preferences: preferences ?? null })
  return user
}

export async function signUp(input: {
  email: string
  password: string
  displayName: string
}): Promise<RegisterResponse> {
  const result = await api.auth.register(input)
  if (result.verificationRequired) {
    store.set({ status: 'guest', user: null, preferences: null })
    return result
  }
  const { preferences } = await api.auth.getSession()
  store.set({ status: 'authed', user: result.user, preferences: preferences ?? null })
  return result
}

export async function signOut(): Promise<void> {
  await api.auth.logout()
  store.set({ status: 'guest', user: null, preferences: null })
}

export function setUser(user: PublicUser): void {
  const current = store.get()
  store.set({ ...current, status: 'authed', user })
}

export function setPreferences(preferences: UserPreferences): void {
  const current = store.get()
  store.set({ ...current, preferences })
}
