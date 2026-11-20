import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_AVATAR, validateAvatar } from './avatarConfig'
import { GUEST_AVATAR_KEY, loadAvatar, saveAvatar } from './avatarConfigService'

const appearance = { ...DEFAULT_AVATAR, hairColor: '#a58bd7', shirtColor: '#e67b58' }
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('avatar storage', () => {
  it('persists only validated supported colors for guests', async () => {
    expect(await saveAvatar(appearance, false)).toEqual(appearance)
    expect(JSON.parse(localStorage.getItem(GUEST_AVATAR_KEY)!)).toEqual(appearance)
    expect(await loadAvatar(false)).toEqual(appearance)
    expect(() => validateAvatar({ ...appearance, hairstyleId: 'fake' })).toThrow()
    expect(() => validateAvatar({ ...appearance, eyeColor: 'red' })).toThrow()
    expect(() => validateAvatar({ ...appearance, version: 2 })).toThrow()
  })
  it('recovers invalid local data without silently overwriting it', async () => {
    localStorage.setItem(GUEST_AVATAR_KEY, '{broken')
    expect(await loadAvatar(false)).toEqual(DEFAULT_AVATAR)
    expect(localStorage.getItem(GUEST_AVATAR_KEY)).toBe('{broken')
  })
  it('reports a storage failure and preserves the last successful save', async () => {
    await saveAvatar(appearance, false)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded') })
    await expect(saveAvatar(DEFAULT_AVATAR, false)).rejects.toThrow()
    expect(await loadAvatar(false)).toEqual(appearance)
  })
  it('uses the account endpoint and never substitutes a local save on server failure', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ avatarConfig: appearance }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    expect(await saveAvatar(appearance, true)).toEqual(appearance)
    expect(fetch).toHaveBeenCalledWith('/api/auth/avatar', expect.objectContaining({ method: 'PATCH', credentials: 'include', body: JSON.stringify(appearance) }))
    expect(localStorage.getItem(GUEST_AVATAR_KEY)).toBeNull()
    fetch.mockResolvedValue(new Response('{}', { status: 503 }))
    await expect(saveAvatar(appearance, true)).rejects.toThrow()
    expect(localStorage.getItem(GUEST_AVATAR_KEY)).toBeNull()
  })
})
