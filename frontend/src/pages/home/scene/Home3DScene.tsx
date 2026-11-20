import { useEffect, useLayoutEffect } from 'react'
import type { CharacterStatus } from './CharacterModel'
import { StaticFallbackScene } from './StaticFallbackScene'
import { useCosmicEnvironment } from '../../../components/cosmic/CosmicContext'

/** Bind Home's unchanged character/planet composition to the persistent canvas. */
export function Home3DScene({ onCharacterStatus, onFeetOffset }: {
  onCharacterStatus: (status: CharacterStatus) => void
  onFeetOffset?: (y: number | null) => void
}) {
  const { available, ready, bindHome } = useCosmicEnvironment()
  useLayoutEffect(() => {
    bindHome({ onCharacterStatus, onFeetOffset })
    return () => bindHome(null)
  }, [bindHome, onCharacterStatus, onFeetOffset])
  useEffect(() => {
    if (!available) onCharacterStatus('error')
  }, [available, onCharacterStatus])
  return !available || !ready ? <StaticFallbackScene /> : null
}
