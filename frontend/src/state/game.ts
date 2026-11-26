import { createStore, useStore } from '../lib/store'
import type { StreetCredentials, StreetSession } from '../lib/contracts'

// Holds the active singleplayer game's credentials (and optionally the initial
// session returned directly from POST /api/singleplayer/games) across the
// setup -> play navigation so Round 1 starts without extra HTTP hops.

const store = createStore<StreetCredentials | null>(null)
let initialSession: StreetSession | null = null

export function useGameCredentials(): StreetCredentials | null {
  return useStore(store)
}

export function setGameCredentials(
  credentials: StreetCredentials | null,
  session: StreetSession | null = null,
): void {
  initialSession = credentials && session && session.id === credentials.id ? session : null
  store.set(credentials)
}

export function consumeInitialGameSession(gameId: string): StreetSession | null {
  if (!initialSession || initialSession.id !== gameId) return null
  const session = initialSession
  initialSession = null
  return session
}
