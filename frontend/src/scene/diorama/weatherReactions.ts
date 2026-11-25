import { MathUtils } from 'three'
import type { RoundScene } from '../../lib/contracts'

/**
 * Measured head + hair envelope for puppet-kid.glb scaled to TARGET_HEIGHT (1.85),
 * including Jump vertical headroom (+0.07) and safety padding.
 * All head-adjacent particles and overhead props must stay strictly outside this box.
 */
export const HEAD_CLEARANCE = {
  maxAbsX: 0.65,
  maxAbsZ: 0.61,
  minY: 0.7,
  maxY: 1.94,
} as const

/**
 * World-space ground anchor for the low-poly rain/storm umbrella:
 * placed in the clear inner explorer pad (r < 1.75) behind-left of spawn
 * so it never blocks the initial camera view or overlaps the spawn shadow.
 */
export const UMBRELLA_ANCHOR = {
  x: -1.04,
  z: -0.58,
  obstacleRadius: 0.48,
  canopyRimY: 2.12,
  canopyRadius: 0.92,
} as const

export const SWEAT_DROP_COUNT = 3
export const SWEAT_DROP_RADIUS = 0.048
const SWEAT_CYCLE_SECONDS = 1.65

export const BREATH_PUFF_COUNT = 3
const BREATH_CYCLE_SECONDS = 2.8
const BREATH_EXHALE_FRACTION = 0.58

export interface ExplorerWeatherFlags {
  isHot: boolean
  isFreezing: boolean
  isCold: boolean
  hasUmbrella: boolean
  windBand: RoundScene['windBand']
}

export function weatherFlagsForScene(scene: RoundScene): ExplorerWeatherFlags {
  const isFreezing = scene.temperatureBand === 'freezing' || scene.weather === 'snow'
  return {
    isHot: scene.temperatureBand === 'hot',
    isFreezing,
    isCold: isFreezing || scene.temperatureBand === 'cold',
    hasUmbrella: scene.weather === 'rain' || scene.weather === 'storm',
    windBand: scene.windBand,
  }
}

export interface WrapperBodyMotion {
  /** World-space wind lean around +Z (tilts into the +X wind from WeatherEffects). */
  windLeanZ: number
  /** Local-space shiver roll (non-accumulating). */
  shiverZ: number
  /** Local-space shiver horizontal jitter (non-accumulating). */
  shiverX: number
  /** Local-space curious pitch tilt during sky checks (non-accumulating). */
  pitchX: number
  /** Local-space curious yaw glance during sky checks (non-accumulating). */
  glanceYaw: number
}

export function wrapperBodyMotion(
  flags: ExplorerWeatherFlags,
  mode: string,
  timer: number,
  elapsed: number,
  reducedMotion: boolean,
): WrapperBodyMotion {
  if (reducedMotion) {
    return { windLeanZ: 0, shiverZ: 0, shiverX: 0, pitchX: 0, glanceYaw: 0 }
  }

  const windLeanZ =
    flags.windBand === 'windy'
      ? 0.092 + Math.sin(elapsed * 2.1) * 0.022 + Math.sin(elapsed * 3.7) * 0.009
      : flags.windBand === 'breezy'
        ? 0.03 + Math.sin(elapsed * 1.4) * 0.011
        : 0

  const modeEnvelope = MathUtils.smoothstep(timer, 0, 0.5)
  let shiverZ = 0
  let shiverX = 0
  if (flags.isCold && mode !== 'jump') {
    const periodicBurst = Math.pow(Math.max(0, Math.sin(elapsed * 1.35 + 0.4)), 2.5)
    const cozyBoost = mode === 'cozy' ? 0.9 * modeEnvelope : 0
    const walkDamp = mode === 'walk' ? 0.45 : 1
    const intensity = Math.max(periodicBurst * walkDamp, cozyBoost)
    const freq = flags.isFreezing ? 24 : 21
    const rotAmp = flags.isFreezing ? 0.024 : 0.014
    const posAmp = flags.isFreezing ? 0.012 : 0.007
    shiverZ = Math.sin(elapsed * freq) * rotAmp * intensity
    shiverX = Math.cos(elapsed * freq) * posAmp * intensity
  }

  const isCheckingSky = mode === 'check_sky'
  const pitchX = isCheckingSky ? -0.055 * modeEnvelope : 0
  const glanceYaw = isCheckingSky ? Math.sin(elapsed * 1.55) * 0.28 * modeEnvelope : 0

  return { windLeanZ, shiverZ, shiverX, pitchX, glanceYaw }
}

export interface SweatDropState {
  x: number
  y: number
  z: number
  scale: number
  opacity: number
}

const SWEAT_SLOTS = [
  { side: 1, baseX: 0.8, baseY: 1.6, z: 0.24, dropY: 0.44, phaseOffset: 0 },
  { side: -1, baseX: 0.82, baseY: 1.54, z: 0.28, dropY: 0.4, phaseOffset: 0.34 },
  { side: 1, baseX: 0.84, baseY: 1.66, z: 0.16, dropY: 0.46, phaseOffset: 0.68 },
] as const

/**
 * Floating sweat-drop particle trajectory in explorer-local space (yawRef).
 * Always stays strictly outside HEAD_CLEARANCE.maxAbsX + SWEAT_DROP_RADIUS.
 */
export function sweatDropMotion(index: number, elapsed: number): SweatDropState {
  const slot = SWEAT_SLOTS[index % SWEAT_SLOTS.length]!
  const p = (((elapsed / SWEAT_CYCLE_SECONDS) + slot.phaseOffset) % 1 + 1) % 1
  const popOut = Math.sin(p * Math.PI * 0.5) * 0.13
  const x = slot.side * (slot.baseX + popOut)
  const y = slot.baseY - p * p * slot.dropY
  const z = slot.z
  const fadeIn = MathUtils.smoothstep(p, 0, 0.18)
  const fadeOut = 1 - MathUtils.smoothstep(p, 0.72, 1)
  const scale = fadeIn * fadeOut
  return { x, y, z, scale, opacity: scale * 0.88 }
}

export interface BreathPuffState {
  x: number
  y: number
  z: number
  radius: number
  opacity: number
  visible: boolean
}

/**
 * Rhythmic freezing breath vapor puff trajectory in explorer-local space (yawRef).
 * Back edge (z - radius) always stays strictly in front of HEAD_CLEARANCE.maxAbsZ.
 */
export function breathPuffMotion(index: number, elapsed: number): BreathPuffState {
  const cyclePos = ((elapsed / BREATH_CYCLE_SECONDS) % 1 + 1) % 1
  const stagger = index * 0.08
  const localT = cyclePos - stagger
  if (localT <= 0 || localT >= BREATH_EXHALE_FRACTION) {
    return { x: 0, y: 1.06, z: 0.74, radius: 0.048, opacity: 0, visible: false }
  }
  const p = localT / BREATH_EXHALE_FRACTION
  const x = (index - 1) * 0.055 + Math.sin(p * Math.PI * 2 + index) * 0.04
  const y = 1.06 + p * 0.34
  const z = 0.74 + p * 0.52
  const radius = 0.048 + p * 0.085
  const opacity = Math.sin(p * Math.PI) * 0.56
  return { x, y, z, radius, opacity, visible: opacity > 0.01 }
}
