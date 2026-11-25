const GUEST_NAME_STORAGE_KEY = 'terraguessr.guestName.v1'
const MAX_DISPLAY_NAME_LENGTH = 40

const GUEST_ADJECTIVES = [
  'Wandering',
  'Cosmic',
  'Solar',
  'Starry',
  'Drifting',
  'Curious',
  'Astral',
  'Swift',
  'Lunar',
  'Orbiting',
] as const

const GUEST_NOUNS = [
  'Nix',
  'Nova',
  'Mira',
  'Orion',
  'Sora',
  'Vega',
  'Atlas',
  'Lyra',
  'Kite',
  'Comet',
] as const

export function generateGuestName(random: () => number = Math.random): string {
  const adjective = GUEST_ADJECTIVES[Math.floor(random() * GUEST_ADJECTIVES.length) % GUEST_ADJECTIVES.length]
  const noun = GUEST_NOUNS[Math.floor(random() * GUEST_NOUNS.length) % GUEST_NOUNS.length]
  return `${adjective} ${noun}`
}

export function readOrCreateGuestName(): string {
  try {
    const saved = localStorage.getItem(GUEST_NAME_STORAGE_KEY)?.trim()
    if (saved) return saved.slice(0, MAX_DISPLAY_NAME_LENGTH)
  } catch {
    return generateGuestName()
  }

  const generated = generateGuestName()
  storeGuestName(generated)
  return generated
}

export function storeGuestName(name: string): void {
  const trimmed = name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH)
  if (!trimmed) return
  try {
    localStorage.setItem(GUEST_NAME_STORAGE_KEY, trimmed)
  } catch {
    /* ignore */
  }
}

export function disambiguateDisplayName(
  name: string,
  existingNames: ReadonlyArray<string | null>,
): string {
  const trimmed = name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH)
  const taken = new Set(
    existingNames
      .filter((entry): entry is string => Boolean(entry))
      .map((entry) => entry.trim().toLowerCase()),
  )

  if (!taken.has(trimmed.toLowerCase())) return trimmed

  for (let suffix = 2; ; suffix += 1) {
    const tag = ` (${suffix})`
    const base = trimmed.slice(0, MAX_DISPLAY_NAME_LENGTH - tag.length).trimEnd()
    const candidate = `${base}${tag}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}
