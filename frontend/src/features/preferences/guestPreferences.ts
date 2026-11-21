import type { UserPreferences } from '../../api/types'

const GUEST_PREFERENCES_KEY = 'terraguessr.preferences.guest.v1'

export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'userId'> = {
  language: 'en',
  soundFxVolume: 50,
  musicVolume: 35,
  fullscreen: false,
}

export function loadGuestPreferences(): Omit<UserPreferences, 'userId'> {
  const raw = localStorage.getItem(GUEST_PREFERENCES_KEY)
  if (!raw) return { ...DEFAULT_PREFERENCES }
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function saveGuestPreferences(
  changes: Partial<Omit<UserPreferences, 'userId'>>,
): Omit<UserPreferences, 'userId'> {
  const updated = { ...loadGuestPreferences(), ...changes }
  localStorage.setItem(GUEST_PREFERENCES_KEY, JSON.stringify(updated))
  return updated
}
