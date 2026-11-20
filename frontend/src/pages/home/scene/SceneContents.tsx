import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import {
  EARTH_Z,
  getEarthRadius,
  getFallbackApexFrac,
  OCEAN_FILL,
  PLANET_CONTACT_OVERLAP_PX,
  PLANET_FALLBACK_ANCHOR_OVERLAP_PX,
  screenYToWorldY,
  SUN_DIRECTION,
} from './composition'
import { PlanetEarth } from './PlanetEarth'
import { CharacterModel } from './CharacterModel'
import type { CharacterStatus } from './CharacterModel'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import type { PointerState } from './hooks'

const SUN_POSITION: [number, number, number] = [
  SUN_DIRECTION[0] * 12,
  SUN_DIRECTION[1] * 12,
  SUN_DIRECTION[2] * 12,
]

export function SceneContents({
  reducedMotion,
  pointerRef,
  onCharacterStatus,
  onFeetPixelY,
}: {
  reducedMotion: boolean
  pointerRef: React.RefObject<PointerState>
  onCharacterStatus: (status: CharacterStatus) => void
  /** Reports the character's measured sole-contact line in viewport-relative
   * CSS pixels (the same coordinate space as `getBoundingClientRect()`), so a
   * plain DOM element (the Edit Avatar button) outside the canvas can anchor
   * to it directly. */
  onFeetPixelY?: (y: number | null) => void
}) {
  const size = useThree((state) => state.size)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const aspect = size.width / Math.max(1, size.height)
  const earthRadius = useMemo(() => getEarthRadius(aspect), [aspect])

  // Primary anchor: the character's own measured sole-contact line, reported
  // by CharacterModel from the same bounding box (unioned over the whole idle
  // cycle) and fit transform it actually renders with — the real rendered
  // foot position, not a DOM container's edge.
  const [feetPixelY, setFeetPixelY] = useState<number | null>(null)

  // Fallback anchor, used only until the first character measurement lands
  // (or if the character fails to render at all): the avatar/button DOM
  // box's bottom edge, measured the same way the old composition.ts fraction
  // table used to be — so the planet is never positioned by pure guesswork.
  const [avatarBottomPx, setAvatarBottomPx] = useState<number | null>(null)
  useLayoutEffect(() => {
    const home = document.querySelector('.th-home')
    const anchor = home?.querySelector('.th-avatar-display')
    if (!anchor) return
    const update = () => {
      const canvas = gl.domElement.getBoundingClientRect()
      const target = anchor.getBoundingClientRect()
      setAvatarBottomPx(target.bottom - canvas.top)
      invalidate()
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(anchor)
    observer.observe(home!)
    return () => observer.disconnect()
  }, [gl, invalidate])

  const apexPixelY =
    feetPixelY != null
      ? feetPixelY - PLANET_CONTACT_OVERLAP_PX
      : avatarBottomPx != null
        ? avatarBottomPx - PLANET_FALLBACK_ANCHOR_OVERLAP_PX
        : size.height * getFallbackApexFrac(aspect)
  // PlanetEarth.tsx scales its *solid* ocean mesh down to OCEAN_FILL of the
  // nominal `earthRadius` (the rest is headroom for decoration that pokes
  // above it) — solving for the apex must use that real surface radius, or
  // the anchor overshoots by ~20% of the radius past where the globe
  // actually renders.
  const earthCenterY = screenYToWorldY(apexPixelY, size.height, EARTH_Z) - earthRadius * OCEAN_FILL

  useEffect(() => {
    if (feetPixelY == null) {
      onFeetPixelY?.(null)
      return
    }
    // feetPixelY is canvas-local (measured from the canvas's own top); convert
    // to viewport-relative pixels, the same space getBoundingClientRect()
    // gives the plain DOM button, so it can anchor to the real foot position.
    onFeetPixelY?.(feetPixelY + gl.domElement.getBoundingClientRect().top)
  }, [feetPixelY, gl, onFeetPixelY])

  return (
    <>
      {/* One coherent "environment": a warm sun key + cool hemisphere fill shared
          by the Earth and the character, plus a faint cool kicker for depth. */}
      <hemisphereLight args={['#cfe3ff', '#0a0e1f', 0.8]} />
      <directionalLight
        position={SUN_POSITION}
        intensity={2.1}
        color="#fff3dd"
      />
      <directionalLight
        position={[-4, 1.2, 2.5]}
        intensity={0.22}
        color="#7f9bff"
      />
      <pointLight
        position={[0, 2.4, 6]}
        intensity={0.3}
        color="#dce8ff"
        distance={10}
        decay={2}
      />
      <Suspense fallback={null}>
        <PlanetEarth
          centerY={earthCenterY}
          radius={earthRadius}
          reducedMotion={reducedMotion}
        />
      </Suspense>
      <SceneErrorBoundary
        fallback={null}
        onError={() => {
          onCharacterStatus('error')
          setFeetPixelY(null)
        }}
      >
        <Suspense fallback={null}>
          <CharacterModel
            reducedMotion={reducedMotion}
            pointerRef={pointerRef}
            onStatus={onCharacterStatus}
            onFeetPixelY={setFeetPixelY}
          />
        </Suspense>
      </SceneErrorBoundary>
    </>
  )
}
