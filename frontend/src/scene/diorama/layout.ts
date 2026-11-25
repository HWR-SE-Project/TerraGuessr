import type { Biome, RoundScene } from '../../lib/contracts'
import { createRng, scatterRing } from './prng'

export interface PropTransform {
  x: number
  z: number
  angle: number
  scale: number
  variant: number
}

export interface IslandObstacle {
  x: number
  z: number
  radius: number
}

export interface BiomeLayout {
  primary: PropTransform[]
  secondary: PropTransform[]
  obstacles: IslandObstacle[]
  /** Safe walk radius inside the island rim (smaller on coast to stay on the sandy cove). */
  walkRadius: number
}

export const CONTACT_SHADOW_RADIUS = 0.7

export function walkRadiusFor(biome: Biome) {
  return biome === 'coast' ? 3.15 : 3.9
}

function primaryObstacleRadius(biome: Biome, scale: number): number {
  switch (biome) {
    case 'mountains':
      return 1.05 * scale
    case 'urban':
      return 0.68 * scale
    case 'tundra':
      return 0.78 * scale
    case 'desert':
      return 0.74 * scale
    case 'forest':
    case 'grasslands':
      return 0.62 * scale
    case 'coast':
      return 0.55 * scale
  }
}

/**
 * Deterministic biome prop placement shared between `BiomeProps` and
 * `DioramaExplorer` so the character can stroll around obstacles and walk up
 * to real trees, boulders, cacti, and landmarks to inspect them.
 */
export function getBiomeLayout(scene: Pick<RoundScene, 'seed' | 'biome'>): BiomeLayout {
  const rng = createRng(scene.seed ^ 0x517cc1b7)
  const primaryCount =
    scene.biome === 'forest'
      ? 16
      : scene.biome === 'urban'
        ? 12
        : scene.biome === 'grasslands'
          ? 14
          : 11
  const maxR = scene.biome === 'coast' ? 3.65 : 4.45

  // Keep the front viewing corridor (z > 1.2, |x| < 1.65) clear of tall landmarks
  // so the explorer avatar is always framed cleanly on initial view.
  const primaryScatter: PropTransform[] = scatterRing(rng, primaryCount + 4, 1.9, maxR, 0.9, 0.78, 1.24)
    .filter((p) => !(p.z > 1.2 && Math.abs(p.x) < 1.65))
    .slice(0, primaryCount)
    .map((p) => ({ ...p, variant: rng() }))

  const secondaryScatter: PropTransform[] = scatterRing(
    rng,
    scene.biome === 'tundra' ? 10 : 8,
    1.75,
    maxR,
    0.75,
    0.65,
    1.15,
  ).map((p) => ({ ...p, variant: rng() }))

  const primary = scene.biome === 'coast' ? primaryScatter.slice(0, 7) : primaryScatter
  const secondary = scene.biome === 'urban' ? secondaryScatter.slice(0, 6) : secondaryScatter
  const obstacles: IslandObstacle[] = [
    ...primary.map((p) => ({
      x: p.x,
      z: p.z,
      radius: primaryObstacleRadius(scene.biome, p.scale),
    })),
    ...secondary.map((p) => ({
      x: p.x,
      z: p.z,
      radius: 0.48 * p.scale,
    })),
  ]

  if (scene.biome === 'coast') {
    obstacles.push({ x: 3.35, z: 1.35, radius: 1.0 })
  }

  return {
    primary,
    secondary,
    obstacles,
    walkRadius: walkRadiusFor(scene.biome),
  }
}
