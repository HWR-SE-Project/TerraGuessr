/**
 * Pure math for placing the Earth/character inside the 3D scene so the
 * composition tracks the original flat design across aspect ratios.
 * No three.js imports here so this stays out of the eagerly-loaded bundle.
 */

export const CAMERA_FOV = 30
export const CAMERA_Z = 10
export const CHARACTER_MODEL_HEIGHT = 2.6

/** Shared "sun" direction (world space, points toward the light source) so the
 * Earth's key light, its atmosphere hotspot, and the character's lighting all
 * agree on where the light is coming from. */
export const SUN_DIRECTION: [number, number, number] = [0.52, 0.34, 0.79]

interface CompositionProfile {
  earthApexFrac: number
  earthRadiusFactor: number
  charCenterFrac: number
  charHeightFrac: number
}

// Tuned against the real desktop (1920x1080) and mobile (390x844) layouts.
const WIDE: CompositionProfile = {
  earthApexFrac: 0.61,
  earthRadiusFactor: 3.8,
  charCenterFrac: 0.585,
  charHeightFrac: 0.305,
}
const NARROW: CompositionProfile = {
  earthApexFrac: 0.63,
  earthRadiusFactor: 4.2,
  charCenterFrac: 0.49,
  charHeightFrac: 0.32,
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function getProfile(aspect: number): CompositionProfile {
  const t = Math.min(1, Math.max(0, (aspect - 0.55) / (1.3 - 0.55)))
  return {
    earthApexFrac: lerp(NARROW.earthApexFrac, WIDE.earthApexFrac, t),
    earthRadiusFactor: lerp(
      NARROW.earthRadiusFactor,
      WIDE.earthRadiusFactor,
      t,
    ),
    charCenterFrac: lerp(NARROW.charCenterFrac, WIDE.charCenterFrac, t),
    charHeightFrac: lerp(NARROW.charHeightFrac, WIDE.charHeightFrac, t),
  }
}

export interface SceneLayout {
  frustumHalfHeight: number
  earthCenterY: number
  earthRadius: number
  characterFeetY: number
  characterScale: number
}

/** World-space Y for a given fraction of the viewport, measured top (0) to bottom (1). */
function worldY(frustumHalfHeight: number, frac: number) {
  return frustumHalfHeight * (1 - 2 * frac)
}

export function computeSceneLayout(aspect: number): SceneLayout {
  const fovRad = (CAMERA_FOV * Math.PI) / 180
  const frustumHalfHeight = Math.tan(fovRad / 2) * CAMERA_Z
  const profile = getProfile(aspect)

  const earthRadius = frustumHalfHeight * profile.earthRadiusFactor
  const earthApexY = worldY(frustumHalfHeight, profile.earthApexFrac)
  const earthCenterY = earthApexY - earthRadius

  const characterCenterWorldY = worldY(
    frustumHalfHeight,
    profile.charCenterFrac,
  )
  const characterWorldHeight = profile.charHeightFrac * 2 * frustumHalfHeight
  const characterScale = characterWorldHeight / CHARACTER_MODEL_HEIGHT
  // The character model's local origin is at its feet (y=0), not its vertical
  // center, so convert the center anchor down to a feet anchor before scaling.
  const characterFeetY = characterCenterWorldY - characterWorldHeight / 2

  return {
    frustumHalfHeight,
    earthCenterY,
    earthRadius,
    characterFeetY,
    characterScale,
  }
}
