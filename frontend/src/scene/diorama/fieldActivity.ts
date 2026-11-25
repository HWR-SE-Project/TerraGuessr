import { MathUtils } from 'three'
import type { RoundScene } from '../../lib/contracts'

export const ACTIVITY_DURATION = 3
export type Activity = 'snowball' | 'leaf' | 'ripple'

export function fieldActivity(scene: RoundScene): Activity | null {
  if (scene.weather === 'rain' || scene.weather === 'storm') return 'ripple'
  if (scene.weather === 'snow' || scene.biome === 'tundra' ||
      (scene.temperatureBand === 'freezing' && scene.biome !== 'desert')) return 'snowball'
  if (scene.biome === 'forest' || scene.biome === 'grasslands') return 'leaf'
  return null
}

// All distances are relative to the feet. Even the tips of the leaf and ball
// stay below knee height. No transform depends on the head, wrist or clip.
export function groundMotion(activity: Activity, elapsed: number) {
  const progress = MathUtils.smoothstep(elapsed, 0, ACTIVITY_DURATION)
  const scale = MathUtils.smoothstep(progress, 0, 0.16) * (1 - MathUtils.smoothstep(progress, 0.8, 1))
  if (activity === 'ripple') {
    return { x: 0.48, y: 0.015, z: 0.28, roll: 0, scale: scale * (0.3 + progress) }
  }
  if (activity === 'leaf') {
    return { x: -0.6 + progress * 1.2, y: 0.09 + Math.sin(progress * Math.PI) * 0.14,
      z: 0.52, roll: Math.sin(progress * Math.PI * 4) * 0.6, scale }
  }
  return { x: -0.34 - progress * 0.62, y: 0.12 * scale, z: 0.32, roll: progress * 5.2, scale }
}
