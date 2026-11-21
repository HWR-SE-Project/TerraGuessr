import { Suspense, useLayoutEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { PlanetEarth } from './Planet'
import { Character } from './Character'
import { usePointerParallax, usePrefersReducedMotion, useWebGLSupport } from './hooks'
import { EARTH_Z, PLANET_CONTACT_OVERLAP_PX, PLANET_BOTTOM_MARGIN_RATIO, CAMERA_FOV, CAMERA_Z, screenYToWorldY, sphereCenterY } from './composition'
import earthFallback from '../assets/images/earth-horizon.webp'

export interface HomeLayout {
  left: number
  top: number
  width: number
  height: number
}

function useCharacterLayout(): HomeLayout | null {
  const { gl, size } = useThree()
  const [layout, setLayout] = useState<HomeLayout | null>(null)
  useLayoutEffect(() => {
    const slot = document.querySelector('.home-character-slot')
    if (!slot) return
    let frame = 0
    const measure = () => {
      const canvas = gl.domElement.getBoundingClientRect()
      const target = slot.getBoundingClientRect()
      const next = {
        left: target.left - canvas.left,
        top: target.top - canvas.top,
        width: target.width,
        height: target.height,
      }
      setLayout((previous) =>
        previous &&
        ['left', 'top', 'width', 'height'].every(
          (key) => Math.abs(previous[key as keyof HomeLayout] - next[key as keyof HomeLayout]) < 0.1,
        )
          ? previous
          : next,
      )
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    const observer = new ResizeObserver(schedule)
    observer.observe(slot)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [gl, size.width, size.height])
  return layout
}

function SceneContents() {
  const reducedMotion = usePrefersReducedMotion()
  const pointerRef = usePointerParallax(!reducedMotion)
  const { size } = useThree()
  const layout = useCharacterLayout()
  const [feetPixelY, setFeetPixelY] = useState<number | null>(null)

  const isNarrow = size.width <= 600
  const rawApexPixelY =
    (feetPixelY ?? (layout ? layout.top + layout.height * 0.97 : size.height * 0.7)) -
    PLANET_CONTACT_OVERLAP_PX
  // Nudge the fit zone down a bit below the character's feet (purely a
  // vertical-placement tweak), then fit the planet's full sphere — apex to
  // nadir — inside the space below that, so it reads as a whole floating
  // planet rather than a horizon cropped by the canvas edge.
  const apexPixelY = rawApexPixelY + size.height * 0.32
  const bottomMarginPx = size.height * PLANET_BOTTOM_MARGIN_RATIO
  const verticalRadiusPx = Math.max((size.height - bottomMarginPx - apexPixelY) / 2, 40)
  const horizontalRadiusPx = size.width * (isNarrow ? 0.7 : 0.78)
  const radiusPx = Math.min(verticalRadiusPx, horizontalRadiusPx)
  const earthRadius = Math.abs(
    screenYToWorldY(0, size.height, EARTH_Z) - screenYToWorldY(radiusPx, size.height, EARTH_Z),
  )
  const earthCenterY = sphereCenterY(apexPixelY, size.height, earthRadius)

  return (
    <>
      <hemisphereLight args={['#cfe3ff', '#0a0e1f', 0.8]} />
      <directionalLight position={[6.2, 4.1, 9.5]} intensity={2.1} color="#fff3dd" />
      <directionalLight position={[-4, 1.2, 2.5]} intensity={0.22} color="#7f9bff" />
      <Stars radius={120} depth={40} count={1600} factor={3.2} saturation={0} fade speed={0.6} />
      <Suspense fallback={null}>
        <group position={[0, earthCenterY, 0]}>
          <PlanetEarth radius={earthRadius} reducedMotion={reducedMotion} />
        </group>
      </Suspense>
      <Suspense fallback={null}>
        <Character
          reducedMotion={reducedMotion}
          pointerRef={pointerRef}
          layout={layout}
          onFeetPixelY={setFeetPixelY}
        />
      </Suspense>
    </>
  )
}

/** The home hero 3D scene (planet + explorer). Falls back to a static image. */
export function HomeScene() {
  const supported = useWebGLSupport()
  if (!supported) {
    return (
      <div className="absolute inset-0" aria-hidden="true">
        <img src={earthFallback} alt="" className="h-full w-full object-cover" fetchPriority="high" />
      </div>
    )
  }
  return (
    <Canvas
      className="absolute inset-0"
      camera={{ fov: CAMERA_FOV, position: [0, 0, CAMERA_Z] }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <SceneContents />
    </Canvas>
  )
}
