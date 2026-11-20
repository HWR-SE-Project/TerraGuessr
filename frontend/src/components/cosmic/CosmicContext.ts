import { createContext, useContext, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { CharacterStatus } from '../../pages/home/scene/CharacterModel'

export interface HomeSceneBinding {
  onCharacterStatus: (status: CharacterStatus) => void
  onFeetPixelY?: (y: number | null) => void
}

export const CosmicContext = createContext<{
  available: boolean
  ready: boolean
  bindHome: (home: HomeSceneBinding | null) => void
  setMode: (mode: { pathname: string; enabled: boolean } | null) => void
} | null>(null)

export function useCosmicEnvironment() {
  const context = useContext(CosmicContext)
  if (!context) throw new Error('CosmicBackground must wrap the application')
  return context
}

/** Only the Street View page overrides the route's default environment policy. */
export function useCosmicBackgroundMode(enabled: boolean) {
  const { pathname } = useLocation()
  const { setMode } = useCosmicEnvironment()
  useLayoutEffect(() => {
    setMode({ pathname, enabled })
    return () => setMode(null)
  }, [enabled, pathname, setMode])
}
