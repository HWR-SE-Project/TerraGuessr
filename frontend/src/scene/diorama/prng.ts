/** Deterministic seeded PRNG (mulberry32) for procedural diorama layouts. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

export interface ScatterPoint {
  x: number
  z: number
  angle: number
  scale: number
}

/**
 * Scatter points in an annular ring around the island center while enforcing a
 * minimum separation distance so low-poly props never overlap awkwardly.
 */
export function scatterRing(
  rng: () => number,
  count: number,
  minRadius: number,
  maxRadius: number,
  minSpacing = 0.75,
  minScale = 0.75,
  maxScale = 1.25,
): ScatterPoint[] {
  const points: ScatterPoint[] = []
  const maxAttempts = count * 18
  for (let attempt = 0; attempt < maxAttempts && points.length < count; attempt++) {
    const theta = rng() * Math.PI * 2
    const r = Math.sqrt(rng() * (maxRadius * maxRadius - minRadius * minRadius) + minRadius * minRadius)
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const tooClose = points.some((p) => Math.hypot(p.x - x, p.z - z) < minSpacing)
    if (tooClose) continue
    points.push({
      x,
      z,
      angle: rng() * Math.PI * 2,
      scale: randRange(rng, minScale, maxScale),
    })
  }
  return points
}
