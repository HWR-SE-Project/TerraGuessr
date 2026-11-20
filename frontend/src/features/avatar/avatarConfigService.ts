import { useSyncExternalStore } from 'react'
import { apiFetch } from '../../api/client'
import { DEFAULT_AVATAR, validateAvatar } from './avatarConfig'
import type { AvatarConfig } from './avatarConfig'

export const GUEST_AVATAR_KEY = 'terraguessr.avatar.guest.v1'
let saved: AvatarConfig = DEFAULT_AVATAR
const listeners = new Set<() => void>()
export function publishAvatar(config: AvatarConfig) {
  saved = config
  listeners.forEach(listener => listener())
}
export function useSavedAvatar() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => saved)
}
export async function loadAvatar(account: boolean): Promise<AvatarConfig> {
  if (account) {
    const { avatarConfig } = await apiFetch<{ avatarConfig: unknown }>('/auth/avatar')
    return avatarConfig == null ? { ...DEFAULT_AVATAR } : validateAvatar(avatarConfig)
  }
  const raw = localStorage.getItem(GUEST_AVATAR_KEY)
  if (!raw) return { ...DEFAULT_AVATAR }
  try { return validateAvatar(JSON.parse(raw)) } catch { return { ...DEFAULT_AVATAR } }
}
export async function saveAvatar(config: AvatarConfig, account: boolean): Promise<AvatarConfig> {
  const valid = validateAvatar(config)
  if (account) {
    const result = await apiFetch<{ avatarConfig: unknown }>('/auth/avatar', { method: 'PATCH', body: valid })
    return validateAvatar(result.avatarConfig)
  }
  localStorage.setItem(GUEST_AVATAR_KEY, JSON.stringify(valid))
  return valid
}
