import { Suspense, useLayoutEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { EARTH_Z, OCEAN_FILL, PLANET_CONTACT_OVERLAP_PX, screenYToWorldY, sphereCenterY, SUN_DIRECTION } from './composition'
import { useHomeLayout } from './useHomeLayout'
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
  onFeetOffset,
}: {
  reducedMotion: boolean
  pointerRef: React.RefObject<PointerState>
  onCharacterStatus: (status: CharacterStatus) => void
  /** Sole contact in CSS pixels relative to the reserved character slot. */
  onFeetOffset?: (y: number | null) => void
}) {
  const size = useThree((state) => state.size)
  const layout = useHomeLayout()
  const [feetPixelY, setFeetPixelY] = useState<number | null>(null)
  // Radius follows the reserved scene slot, not total document height. Both
  // cameras use the same CSS measurements even when the page grows/scrolls.
  // Narrow viewports stack the three game-mode cards vertically, leaving less
  // room below the character before the actions begin — shrink the planet a
  // touch there so its silhouette still clears the stacked cards with no scroll.
  const isNarrow = size.width <= 600
  const radiusPx = Math.min(size.width * (isNarrow ? 0.38 : 0.42), (layout?.height ?? 280) * (isNarrow ? 0.48 : 0.6))
  const earthRadius = Math.abs(screenYToWorldY(0, size.height, EARTH_Z) -
    screenYToWorldY(radiusPx, size.height, EARTH_Z))
  const apexPixelY = (feetPixelY ?? (layout ? layout.top + layout.height * 0.97 : size.height * 0.7)) - PLANET_CONTACT_OVERLAP_PX
  const earthCenterY = sphereCenterY(apexPixelY, size.height, earthRadius * OCEAN_FILL)
  useLayoutEffect(() => {
    onFeetOffset?.(layout && feetPixelY != null ? feetPixelY - layout.top : null)
  }, [feetPixelY, layout, onFeetOffset])

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
            layout={layout}
            onFeetPixelY={setFeetPixelY}
          />
        </Suspense>
      </SceneErrorBoundary>
    </>
  )
}
