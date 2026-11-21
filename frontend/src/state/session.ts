import { api } from '../services'
import { createStore, useStore } from '../lib/store'
import type { PublicUser, UserPreferences } from '../lib/contracts'

export type SessionStatus = 'loading' | 'guest' | 'authed'

interface SessionState {
  status: SessionStatus
  user: PublicUser | null
  preferences: UserPreferences | null
}

const store = createStore<SessionState>({
  status: 'loading',
  user: null,
  preferences: null,
})

export function useSession(): SessionState {
  return useStore(store)
}

export async function initSession(): Promise<void> {
  try {
    const session = await api.auth.getSession()
    store.set({
      status: session.user ? 'authed' : 'guest',
      user: session.user,
      preferences: session.preferences ?? null,
    })
  } catch {
    store.set({ status: 'guest', user: null, preferences: null })
  }
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
}): Promise<PublicUser> {
  const { user } = await api.auth.register(input)
  const { preferences } = await api.auth.getSession()
  store.set({ status: 'authed', user, preferences: preferences ?? null })
  return user
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
