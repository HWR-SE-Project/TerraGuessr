import { api } from '../services'
import { createStore, useStore } from '../lib/store'
import type { UserPreferences } from '../lib/contracts'

// Preferences work for both guests (persisted to localStorage) and signed-in
// players (persisted to the account). The UI reads/writes this store; whether
// it lands in localStorage or the account is handled here.

export interface PreferenceState {
  language: 'en' | 'de'
  soundFxVolume: number
  musicVolume: number
  fullscreen: boolean
  /** True once loaded from the backing store. */
  ready: boolean
}

const GUEST_KEY = 'terraguessr.preferences.guest.v1'

const defaults: PreferenceState = {
  language: 'en',
  soundFxVolume: 70,
  musicVolume: 50,
  fullscreen: false,
  ready: false,
}

function readGuest(): PreferenceState {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw), ready: true } : { ...defaults, ready: true }
  } catch {
    return { ...defaults, ready: true }
  }
}

const store = createStore<PreferenceState>({ ...defaults, ready: false })

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement)
    if (store.get().fullscreen !== active) {
      store.set({ ...store.get(), fullscreen: active })
    }
  })
}

export function usePreferences(): PreferenceState {
  return useStore(store)
}

export function hydratePreferences(isAuthed: boolean, prefs?: UserPreferences | null): void {
  if (isAuthed && prefs) {
    store.set({
      language: prefs.language,
      soundFxVolume: prefs.soundFxVolume,
      musicVolume: prefs.musicVolume,
      fullscreen: prefs.fullscreen,
      ready: true,
    })
  } else {
    store.set(readGuest())
  }
}

export async function updatePreference(
  changes: Partial<Omit<PreferenceState, 'ready'>>,
): Promise<void> {
  const next = { ...store.get(), ...changes }
  store.set(next)
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ ...next, ready: undefined }))
  } catch {
    /* ignore */
  }
  // Best-effort account sync; guests simply persist locally.
  try {
    await api.auth.updatePreferences(changes)
  } catch {
    /* ignore — guest or offline */
  }
}

export async function toggleFullscreen(): Promise<void> {
  const next = !store.get().fullscreen
  await updatePreference({ fullscreen: next })
  if (document.fullscreenElement) await document.exitFullscreen()
  else if (next) await document.documentElement.requestFullscreen().catch(() => {})
}
