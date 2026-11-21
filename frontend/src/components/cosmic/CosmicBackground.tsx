import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { usePointerParallax, usePrefersReducedMotion, useWebGLSupport } from '../../pages/home/scene/hooks'
import { SceneErrorBoundary } from '../../pages/home/scene/SceneErrorBoundary'
import { CosmicContext } from './CosmicContext'
import type { HomeSceneBinding } from './CosmicContext'
import './CosmicBackground.css'

const CosmicBackgroundScene = lazy(() => import('./CosmicBackgroundScene').then(module => ({
  default: module.CosmicBackgroundScene,
})))

export type CosmicIntensity = 'full' | 'subdued' | 'moderate'

/** One persistent renderer. Home's models share its depth buffer with the sky. */
export function CosmicBackground({ children, intensity: intensityOverride }: {
  children: ReactNode
  intensity?: CosmicIntensity
}) {
  const { pathname } = useLocation()
  const supportsWebGL = useWebGLSupport()
  const reducedMotion = usePrefersReducedMotion()
  const pointerRef = usePointerParallax(!reducedMotion)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [home, bindHome] = useState<HomeSceneBinding | null>(null)
  const [mode, setMode] = useState<{ pathname: string; enabled: boolean } | null>(null)
  const isHome = pathname === '/'
  const enabled = mode?.pathname === pathname ? mode.enabled : pathname !== '/game/singleplayer'
  const intensity: CosmicIntensity = intensityOverride ?? (isHome || pathname.startsWith('/multiplayer') || pathname.startsWith('/lobby')
    ? 'full' : pathname === '/auth' || pathname === '/reset-password' || pathname === '/settings'
      ? 'subdued' : 'moderate')
  const available = supportsWebGL && !failed
  const context = useMemo(() => ({ available, ready, bindHome, setMode }), [available, ready])
  const onReady = useCallback(() => setReady(true), [])
  const onError = useCallback(() => setFailed(true), [])

  return (
    <CosmicContext.Provider value={context}>
      <div className="cosmic-app" data-cosmic-home={isHome} data-cosmic-intensity={intensity}>
        <div className="cosmic-background" aria-hidden="true" data-enabled={enabled}
          data-ready={ready && available}>
          {available && (
            <SceneErrorBoundary fallback={null} onError={onError}>
              <Suspense fallback={null}>
                <CosmicBackgroundScene enabled={enabled} reducedMotion={reducedMotion}
                  pointerRef={pointerRef} home={isHome ? home : null} isHome={isHome}
                  layoutKey={pathname} onReady={onReady} />
              </Suspense>
            </SceneErrorBoundary>
          )}
        </div>
        {children}
      </div>
    </CosmicContext.Provider>
  )
}
