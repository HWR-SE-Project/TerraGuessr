/**
 * Pure math for placing the Earth/character inside the 3D scene so the
 * composition tracks the original flat design across aspect ratios.
 * No three.js imports here so this stays out of the eagerly-loaded bundle.
 */

export const CAMERA_FOV = 30
export const CAMERA_Z = 10

/** World-space depth the Earth group sits at (pushed back so its near-camera
 * bulge doesn't occlude the character via the z-buffer). Perspective
 * projection means a point this far behind the z=0 plane lands on-screen
 * higher/smaller than "world-Y-at-z=0" math would suggest, so any pixel<->world
 * conversion for the Earth must account for it via `screenYToWorldY` below. */
export const EARTH_Z = -3.4

/** Shared "sun" direction (world space, points toward the light source) so the
 * Earth's key light, its atmosphere hotspot, and the character's lighting all
 * agree on where the light is coming from. */
export const SUN_DIRECTION: [number, number, number] = [0.52, 0.34, 0.79]

/** How far above the measured foot-contact line the Earth's spherical shell's
 * apex should reach, in CSS pixels. A few pixels of overlap reads as actual
 * contact (feet "sinking in" slightly) rather than a hairline gap caused by
 * antialiasing/texture variance at exact 0px alignment. */
export const PLANET_CONTACT_OVERLAP_PX = 24

/** Fallback overlap used only when the real character foot measurement isn't
 * available yet (first frame, or a character render error) and the planet
 * falls back to anchoring off the avatar/button DOM box instead. Larger,
 * because that box's bottom edge sits below the button rather than at the
 * feet themselves. */
export const PLANET_FALLBACK_ANCHOR_OVERLAP_PX = 26

interface CompositionProfile {
  earthRadiusFactor: number
}

// Tuned against the real desktop (1920x1080) and mobile (390x844) layouts.
const WIDE: CompositionProfile = { earthRadiusFactor: 0.55 }
const NARROW: CompositionProfile = { earthRadiusFactor: 0.6 }

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function getProfile(aspect: number): CompositionProfile {
  const t = Math.min(1, Math.max(0, (aspect - 0.55) / (1.3 - 0.55)))
  return {
    earthRadiusFactor: lerp(
      NARROW.earthRadiusFactor,
      WIDE.earthRadiusFactor,
      t,
    ),
  }
}

const FOV_RAD = (CAMERA_FOV * Math.PI) / 180

/** Half the frustum's world-space height at a given world-space z, for the
 * perspective camera defined by CAMERA_FOV/CAMERA_Z above. */
function frustumHalfHeightAtZ(z: number) {
  return Math.tan(FOV_RAD / 2) * (CAMERA_Z - z)
}

/** The Earth's apparent radius scales with how much of the frame it should
 * fill; independent of where its apex is anchored. */
export function getEarthRadius(aspect: number) {
  const frustumHalfHeight = frustumHalfHeightAtZ(0)
  return frustumHalfHeight * getProfile(aspect).earthRadiusFactor
}

/** The origami model's decoration (mountains/trees) reaches ~1.6-2x the ocean
 * shell's own radius, so PlanetEarth.tsx scales the *solid* ocean mesh to only
 * this fraction of `getEarthRadius()` — the nominal radius is deliberately
 * bigger than the real rendered surface. Any code anchoring the planet's
 * apex to a screen position must solve for `centerY + radius * OCEAN_FILL`,
 * not `centerY + radius`, or it overshoots by ~20% of the radius (tens of
 * pixels) past where the solid surface actually renders. */
export const OCEAN_FILL = 0.8

/** Reasonable initial/fallback apex fraction (top-to-bottom of the canvas)
 * for the single frame before the real DOM anchor has been measured. */
export function getFallbackApexFrac(aspect: number) {
  const t = Math.min(1, Math.max(0, (aspect - 0.55) / (1.3 - 0.55)))
  return lerp(0.655, 0.715, t)
}

/** Convert a CSS-pixel Y measured from the top of the canvas into world-space
 * Y at depth `z`, for the main perspective camera. This is the exact inverse
 * projection (unlike a flat z=0 approximation), so a DOM anchor lines up with
 * an object regardless of how far back in Z that object sits. */
export function screenYToWorldY(pixelY: number, canvasHeightPx: number, z: number) {
  const frac = pixelY / canvasHeightPx
  return frustumHalfHeightAtZ(z) * (1 - 2 * frac)
}
