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

const FOV_RAD = (CAMERA_FOV * Math.PI) / 180

/** Half the frustum's world-space height at a given world-space z, for the
 * perspective camera defined by CAMERA_FOV/CAMERA_Z above. */
function frustumHalfHeightAtZ(z: number) {
  return Math.tan(FOV_RAD / 2) * (CAMERA_Z - z)
}

/** The origami model's decoration (mountains/trees) reaches ~1.6-2x the ocean
 * shell's own radius, so PlanetEarth.tsx scales the *solid* ocean mesh to only
 * this fraction of the nominal radius — the nominal radius is deliberately
 * bigger than the real rendered surface. Any code anchoring the planet's
 * apex to a screen position must use `radius * OCEAN_FILL` in the perspective silhouette calculation. */
export const OCEAN_FILL = 0.8

/** Convert a CSS-pixel Y measured from the top of the canvas into world-space
 * Y at depth `z`, for the main perspective camera. This is the exact inverse
 * projection (unlike a flat z=0 approximation), so a DOM anchor lines up with
 * an object regardless of how far back in Z that object sits. */
export function screenYToWorldY(pixelY: number, canvasHeightPx: number, z: number) {
  const frac = pixelY / canvasHeightPx
  return frustumHalfHeightAtZ(z) * (1 - 2 * frac)
}

/** Exact perspective silhouette: the ray through the desired apex is tangent
 * to the ocean sphere. Subtracting radius at a fixed Z drifts as aspect changes. */
export function sphereCenterY(apexPx: number, height: number, radius: number) {
  const depth = CAMERA_Z - EARTH_Z
  const slope = screenYToWorldY(apexPx, height, EARTH_Z) / depth
  return slope * depth - radius * Math.sqrt(1 + slope * slope)
}
