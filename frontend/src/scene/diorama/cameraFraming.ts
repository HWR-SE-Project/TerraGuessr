export interface DioramaCameraFraming {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  distance: number
  fogOffset: number
  maxDistance: number
}

const DESKTOP_FOV = 38
const MAX_MOBILE_FOV = 66
const BASE_TARGET_Y = 0.75
const PORTRAIT_TARGET_Y = 1.0
const BASE_CAMERA_Y = 5.2
const BASE_CAMERA_Z = 12.2
const BASE_DY = BASE_CAMERA_Y - BASE_TARGET_Y
const BASE_DISTANCE = Math.hypot(BASE_DY, BASE_CAMERA_Z)
const BASE_MAX_DISTANCE = 17
/** Minimum visible horizontal half-width at the island plane (island radius is 5.4). */
const MIN_VISIBLE_HALF_WIDTH = 5.9
const REFERENCE_ASPECT =
  MIN_VISIBLE_HALF_WIDTH / (BASE_DISTANCE * Math.tan((DESKTOP_FOV * Math.PI) / 360))

/**
 * Computes responsive camera framing for the 3D biome diorama.
 *
 * Desktop/landscape viewports keep the exact reference framing. Narrow and
 * portrait viewports widen the vertical FOV modestly and pull the camera back
 * along the same elevation ray (with a matching fog offset) so the entire
 * floating island, explorer, and sky clouds stay framed cleanly.
 */
export function dioramaCameraFraming(aspect: number): DioramaCameraFraming {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9
  if (safeAspect >= REFERENCE_ASPECT) {
    return {
      position: [0, BASE_CAMERA_Y, BASE_CAMERA_Z],
      target: [0, BASE_TARGET_Y, 0],
      fov: DESKTOP_FOV,
      distance: BASE_DISTANCE,
      fogOffset: 0,
      maxDistance: BASE_MAX_DISTANCE,
    }
  }

  const t = Math.min(1, Math.max(0, (REFERENCE_ASPECT - safeAspect) / (REFERENCE_ASPECT - 0.45)))
  const fov = DESKTOP_FOV + (MAX_MOBILE_FOV - DESKTOP_FOV) * t
  const tanHalfFov = Math.tan((fov * Math.PI) / 360)
  const neededDistance = MIN_VISIBLE_HALF_WIDTH / (tanHalfFov * Math.max(safeAspect, 0.38))
  const distance = Math.min(22, Math.max(BASE_DISTANCE, neededDistance))
  const scale = distance / BASE_DISTANCE
  const targetY = BASE_TARGET_Y + (PORTRAIT_TARGET_Y - BASE_TARGET_Y) * t
  const fogOffset = Math.max(0, distance - BASE_DISTANCE)

  return {
    position: [0, targetY + BASE_DY * scale, BASE_CAMERA_Z * scale],
    target: [0, targetY, 0],
    fov,
    distance,
    fogOffset,
    maxDistance: BASE_MAX_DISTANCE + fogOffset,
  }
}
