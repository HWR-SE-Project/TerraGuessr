import { describe, expect, it } from 'vitest'
import { greatCircleSegments, normalizeCoordinates } from './geodesic'

describe('geodesic map helpers', () => {
  it('interpolates a single great-circle segment for normal pairs', () => {
    const segments = greatCircleSegments({ lat: 51.5, lon: -0.12 }, { lat: 48.85, lon: 2.35 }, 16)
    expect(segments).toHaveLength(1)
    expect(segments[0]!.length).toBe(17)
    expect(segments[0]![0]![0]).toBeCloseTo(51.5, 4)
    expect(segments[0]!.at(-1)![0]).toBeCloseTo(48.85, 4)
  })

  it('splits segments across the antimeridian instead of wrapping the globe', () => {
    const segments = greatCircleSegments({ lat: 35, lon: 170 }, { lat: 35, lon: -170 }, 24)
    expect(segments.length).toBe(2)
    for (const segment of segments) {
      for (let i = 1; i < segment.length; i++) {
        expect(Math.abs(segment[i]![1] - segment[i - 1]![1])).toBeLessThan(180)
      }
    }
  })

  it('normalizes wrapped longitudes and clamps latitudes', () => {
    expect(normalizeCoordinates(95, 190)).toEqual({ lat: 90, lon: -170 })
    expect(normalizeCoordinates(-95, -190)).toEqual({ lat: -90, lon: 170 })
    expect(normalizeCoordinates(48.5, 11.5)).toEqual({ lat: 48.5, lon: 11.5 })
  })
})
