/** Only capabilities verified against puppet-kid.glb. Null preserves the authored texture. */
export const AVATAR_PARTS = ['hairColor', 'eyeColor', 'shirtColor', 'pantsColor', 'shoeColor'] as const
export type AvatarPart = typeof AVATAR_PARTS[number]
export type AvatarConfig = { version: 1 } & Record<AvatarPart, string | null>
export const DEFAULT_AVATAR: AvatarConfig = {
  version: 1, hairColor: null, eyeColor: null, shirtColor: null, pantsColor: null, shoeColor: null,
}
export function validateAvatar(value: unknown): AvatarConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid avatar configuration')
  const record = value as Record<string, unknown>
  if (record.version !== 1 || Object.keys(record).some(key => key !== 'version' && !AVATAR_PARTS.includes(key as AvatarPart))) throw new Error('Unsupported avatar configuration')
  const result = { ...DEFAULT_AVATAR }
  for (const key of AVATAR_PARTS) {
    const color = record[key]
    if (color !== null && (typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color))) throw new Error('Invalid avatar color')
    result[key] = typeof color === 'string' ? color.toLowerCase() : null
  }
  return result
}
