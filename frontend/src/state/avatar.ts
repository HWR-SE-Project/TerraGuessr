import { api } from '../services'
import { createStore, useStore } from '../lib/store'
import { AVATAR_PARTS } from '../lib/contracts'
import type { AvatarConfig, AvatarPart } from '../lib/contracts'

export const DEFAULT_AVATAR: AvatarConfig = {
  version: 1,
  hairColor: null,
  eyeColor: null,
  shirtColor: null,
  pantsColor: null,
  shoeColor: null,
}

const GUEST_KEY = 'terraguessr.avatar.guest.v1'

function validate(value: unknown): AvatarConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_AVATAR }
  const record = value as Record<string, unknown>
  if (record.version !== 1) return { ...DEFAULT_AVATAR }
  const result = { ...DEFAULT_AVATAR }
  for (const part of AVATAR_PARTS) {
    const color = record[part]
    if (color !== null && (typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color))) continue
    result[part] = typeof color === 'string' ? color.toLowerCase() : null
  }
  return result
}

function readGuest(): AvatarConfig {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    return raw ? validate(JSON.parse(raw)) : { ...DEFAULT_AVATAR }
  } catch {
    return { ...DEFAULT_AVATAR }
  }
}

const store = createStore<AvatarConfig>({ ...DEFAULT_AVATAR })

export function useAvatar(): AvatarConfig {
  return useStore(store)
}

export async function loadAvatar(isAuthed: boolean): Promise<void> {
  try {
    if (isAuthed) {
      const { avatarConfig } = await api.auth.getAvatar()
      store.set(avatarConfig ? validate(avatarConfig) : { ...DEFAULT_AVATAR })
    } else {
      store.set(readGuest())
    }
  } catch {
    store.set(readGuest())
  }
}

export async function saveAvatar(config: AvatarConfig, isAuthed: boolean): Promise<void> {
  const valid = validate(config)
  store.set(valid)
  if (isAuthed) {
    await api.auth.saveAvatar(valid)
  } else {
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(valid))
    } catch {
      /* ignore */
    }
  }
}

export function updateAvatarPart(part: AvatarPart, value: string | null): void {
  store.set({ ...store.get(), [part]: value })
}

export const AVATAR_PALETTE: { name: string; value: string }[] = [
  { name: 'Espresso', value: '#36251e' },
  { name: 'Chestnut', value: '#895236' },
  { name: 'Honey', value: '#d9ab57' },
  { name: 'Pearl', value: '#deded3' },
  { name: 'Lime', value: '#b9ed66' },
  { name: 'Forest', value: '#388365' },
  { name: 'Ocean', value: '#378bce' },
  { name: 'Midnight', value: '#333b67' },
  { name: 'Lilac', value: '#a58bd7' },
  { name: 'Rose', value: '#db769d' },
  { name: 'Coral', value: '#e67b58' },
  { name: 'Charcoal', value: '#353942' },
]
