// Pure math for placing the Earth/character in the home scene across aspect
// ratios. No three.js imports, so this stays out of the eagerly-loaded bundle.

export const CAMERA_FOV = 30
export const CAMERA_Z = 10
export const EARTH_Z = -3.4
export const PLANET_CONTACT_OVERLAP_PX = 170
export const PLANET_BOTTOM_MARGIN_RATIO = 0

const FOV_RAD = (CAMERA_FOV * Math.PI) / 180

function frustumHalfHeightAtZ(z: number) {
  return Math.tan(FOV_RAD / 2) * (CAMERA_Z - z)
}

/** Convert a CSS-pixel Y (from the canvas top) into world Y at depth z. */
export function screenYToWorldY(pixelY: number, canvasHeightPx: number, z: number) {
  const frac = pixelY / canvasHeightPx
  return frustumHalfHeightAtZ(z) * (1 - 2 * frac)
}

/** Exact perspective silhouette: centre a sphere of `radius` so its apex lands at `apexPx`. */
export function sphereCenterY(apexPx: number, height: number, radius: number) {
  const depth = CAMERA_Z - EARTH_Z
  const slope = screenYToWorldY(apexPx, height, EARTH_Z) / depth
  return slope * depth - radius * Math.sqrt(1 + slope * slope)
}
