import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { Biome, RoundScene } from '../../lib/contracts'
import { BiomeDiorama } from './BiomeDiorama'
import { fieldActivity, groundMotion, ACTIVITY_DURATION } from './fieldActivity'
import { getBiomeLayout } from './layout'
import { quipsForScene } from './quips'
import { createRng, scatterRing } from './prng'
import {
  BREATH_PUFF_COUNT,
  HEAD_CLEARANCE,
  SWEAT_DROP_COUNT,
  SWEAT_DROP_RADIUS,
  UMBRELLA_ANCHOR,
  breathPuffMotion,
  sweatDropMotion,
  weatherFlagsForScene,
  wrapperBodyMotion,
} from './weatherReactions'

afterEach(() => {
  cleanup()
})

const sampleScene = (overrides: Partial<RoundScene> = {}): RoundScene => ({
  biome: 'tundra',
  weather: 'snow',
  lighting: 'night',
  temperatureBand: 'freezing',
  windBand: 'windy',
  seed: 424242,
  ...overrides,
})

describe('3D biome diorama logic & WebGL fallback', () => {
  it('generates deterministic scatter points outside the central explorer pad', () => {
    const first = scatterRing(createRng(12345), 12, 1.8, 4.5, 0.7)
    const second = scatterRing(createRng(12345), 12, 1.8, 4.5, 0.7)
    expect(first).toEqual(second)
    expect(first.length).toBeGreaterThan(0)
    for (const point of first) {
      expect(Math.hypot(point.x, point.z)).toBeGreaterThanOrEqual(1.79)
    }
  })

  it('keeps weather reactions near the feet through entry, hold and exit', () => {
    expect(fieldActivity(sampleScene())).toBe('snowball')
    expect(fieldActivity(sampleScene({ weather: 'storm' }))).toBe('ripple')
    expect(fieldActivity(sampleScene({ biome: 'forest', weather: 'clear', temperatureBand: 'mild' }))).toBe('leaf')
    for (const activity of ['snowball', 'ripple', 'leaf'] as const) {
      for (let frame = 0; frame <= 180; frame++) {
        const { y, scale } = groundMotion(activity, frame / 60)
        expect(y + scale * 0.19).toBeLessThan(0.45)
      }
      expect(groundMotion(activity, 0).scale).toBe(0)
      expect(groundMotion(activity, ACTIVITY_DURATION).scale).toBe(0)
    }
  })

  it('only targets rendered coastal and urban props during inspection', () => {
    for (const biome of ['coast', 'urban'] as const) {
      const { primary, secondary, obstacles } = getBiomeLayout({ biome, seed: 1 })
      const rendered = [...primary, ...secondary].map(({ x, z }) => ({ x, z }))
      if (biome === 'coast') rendered.push({ x: 3.35, z: 1.35 })
      expect(obstacles.map(({ x, z }) => ({ x, z }))).toEqual(rendered)
    }
  })

  it('produces weather quips for every biome without leaking location names', () => {
    const biomes: Biome[] = ['desert', 'forest', 'mountains', 'tundra', 'coast', 'grasslands', 'urban']
    for (const biome of biomes) {
      const quips = quipsForScene(sampleScene({ biome }))
      expect(quips.length).toBeGreaterThanOrEqual(4)
      for (const line of quips) {
        expect(line).not.toMatch(/London|Tokyo|Cairo|Norway|Chile/i)
      }
    }
  })

  it('keeps head-adjacent weather particles and rain umbrella strictly clear of the head', () => {
    for (let step = 0; step <= 180; step++) {
      const t = step / 30
      for (let i = 0; i < SWEAT_DROP_COUNT; i++) {
        const drop = sweatDropMotion(i, t)
        expect(Math.abs(drop.x) - SWEAT_DROP_RADIUS).toBeGreaterThan(HEAD_CLEARANCE.maxAbsX)
      }
      for (let i = 0; i < BREATH_PUFF_COUNT; i++) {
        const puff = breathPuffMotion(i, t)
        if (puff.visible) {
          expect(puff.z - puff.radius).toBeGreaterThan(HEAD_CLEARANCE.maxAbsZ)
        }
      }
    }

    const umbrellaDist = Math.hypot(UMBRELLA_ANCHOR.x, UMBRELLA_ANCHOR.z)
    expect(umbrellaDist).toBeGreaterThan(HEAD_CLEARANCE.maxAbsX + UMBRELLA_ANCHOR.obstacleRadius)
    expect(umbrellaDist).toBeLessThan(1.75)
    expect(UMBRELLA_ANCHOR.canopyRimY).toBeGreaterThan(HEAD_CLEARANCE.maxY)
  })

  it('produces non-accumulating wrapper-group shiver and wind lean without reducedMotion leaks', () => {
    const freezingWindy = weatherFlagsForScene(
      sampleScene({ temperatureBand: 'freezing', windBand: 'windy', weather: 'snow' }),
    )
    expect(freezingWindy.isFreezing).toBe(true)
    expect(freezingWindy.isCold).toBe(true)

    const cozy = wrapperBodyMotion(freezingWindy, 'cozy', 2.0, 1.0, false)
    expect(cozy.windLeanZ).toBeGreaterThan(0.05)
    expect(Math.hypot(cozy.shiverZ, cozy.shiverX)).toBeGreaterThan(0)

    const jumping = wrapperBodyMotion(freezingWindy, 'jump', 1.0, 1.0, false)
    expect(jumping.shiverZ).toBe(0)
    expect(jumping.shiverX).toBe(0)

    const reduced = wrapperBodyMotion(freezingWindy, 'cozy', 2.0, 1.0, true)
    expect(reduced).toEqual({ windLeanZ: 0, shiverZ: 0, shiverX: 0, pitchX: 0, glanceYaw: 0 })
  })

  it('renders a clean 2D fallback in non-WebGL environments (CI/jsdom) with interactive quips', async () => {
    const user = userEvent.setup()
    render(<BiomeDiorama scene={sampleScene()} />)
    expect(screen.getByLabelText('Tundra diorama scene')).toBeVisible()
    expect(screen.getByText(/Tundra · snow · night/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Tap explorer for a weather note/i }))
    await waitFor(() => expect(screen.getByRole('status')).toBeVisible())
  })
})
