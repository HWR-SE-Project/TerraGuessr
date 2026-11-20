export const CATEGORIES = [
  { id: 'hair', label: 'Hair', icon: '✦', description: 'A little color. A lot of character.', parts: ['hairColor'] },
  { id: 'face', label: 'Face', icon: '◉', description: 'A fresh outlook on the world.', parts: ['eyeColor'] },
  { id: 'outfit', label: 'Outfit', icon: '♧', description: 'Dress for your next discovery.', parts: ['shirtColor', 'pantsColor', 'shoeColor'] },
] as const
export type AvatarCategory = typeof CATEGORIES[number]['id']
