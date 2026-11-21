import { createStore, useStore } from '../lib/store'
import type { StreetCredentials } from '../lib/contracts'

// Holds the active singleplayer game's credentials across the setup → play
// navigation. In Phase 2 the real backend issues the same opaque credentials.

const store = createStore<StreetCredentials | null>(null)

export function useGameCredentials(): StreetCredentials | null {
  return useStore(store)
}

export function setGameCredentials(credentials: StreetCredentials | null): void {
  store.set(credentials)
}
