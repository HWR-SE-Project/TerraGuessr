import { useEffect, useLayoutEffect } from 'react'
import type { CharacterStatus } from './CharacterModel'
import earth from '../../assets/home/official/earth-horizon.webp'
import { useCosmicEnvironment } from '../cosmic/CosmicContext'

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
  return !available || !ready ? <div className="th-earth" aria-hidden="true"><img src={earth} alt="" fetchPriority="high" /></div> : null
}
