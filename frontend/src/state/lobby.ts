import { createStore, useStore } from '../lib/store'

// The player's membership in a lobby (code + opaque token). The token is
// returned once by create/join; we keep it here so the waiting room and match
// pages can act on the player's behalf. Phase 2 keeps the same shape but
// persists/validates it against the backend.

export interface LobbySession {
  code: string
  token: string
  isHost: boolean
}

const KEY = 'terraguessr.lobby.session.v1'

const store = createStore<LobbySession | null>(readStored())

function readStored(): LobbySession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as LobbySession) : null
  } catch {
    return null
  }
}

export function useLobbySession(): LobbySession | null {
  return useStore(store)
}

export function setLobbySession(session: LobbySession): void {
  store.set(session)
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

export function clearLobbySession(session?: LobbySession): boolean {
  if (session && store.get() !== session) return false
  store.set(null)
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  return true
}
