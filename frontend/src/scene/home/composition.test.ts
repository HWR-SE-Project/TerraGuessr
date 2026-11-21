import { describe, expect, it } from 'vitest'
import { CAMERA_Z, EARTH_Z, screenYToWorldY, sphereCenterY } from './composition'

describe('home perspective contact', () => {
  it('keeps the ocean silhouette tangent to the feet ray across viewport changes', () => {
    for (const height of [432, 768, 844, 1080, 2160]) {
      for (const apex of [height * 0.3, height * 0.7, height * 0.95]) {
        const radius = 1.2
        const center = sphereCenterY(apex, height, radius)
        const depth = CAMERA_Z - EARTH_Z
        const slope = screenYToWorldY(apex, height, EARTH_Z) / depth
        // Distance from sphere center to the ray must equal the ocean radius.
        const distance = Math.abs(center - slope * depth) / Math.sqrt(1 + slope ** 2)
        expect(distance).toBeCloseTo(radius, 10)
      }
    }
  })
})
