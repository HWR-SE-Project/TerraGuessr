import { lazy, Suspense } from 'react'
import { useWebGLSupport, usePrefersReducedMotion, usePointerParallax } from './hooks'
import { StaticFallbackScene } from './StaticFallbackScene'
import { SceneErrorBoundary } from './SceneErrorBoundary'

const Home3DSceneInner = lazy(() =>
  import('./Home3DSceneInner').then((module) => ({ default: module.Home3DSceneInner })),
)

/**
 * Entry point for the interactive hero scene. Renders the flat reference
 * images immediately (and permanently, if WebGL is unavailable), then
 * upgrades in place to the 3D Earth + character once the scene chunk and
 * its textures are ready — so the first paint is never blocked on three.js.
 */
export function Home3DScene() {
  const supportsWebGL = useWebGLSupport()
  const reducedMotion = usePrefersReducedMotion()
  const pointerRef = usePointerParallax(!reducedMotion)

  if (!supportsWebGL) {
    return <StaticFallbackScene />
  }

  return (
    <SceneErrorBoundary fallback={<StaticFallbackScene />}>
      <div className="th-scene3d" aria-hidden="true">
        <Suspense fallback={<StaticFallbackScene />}>
          <Home3DSceneInner reducedMotion={reducedMotion} pointerRef={pointerRef} />
        </Suspense>
      </div>
    </SceneErrorBoundary>
  )
}
