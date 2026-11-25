import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { CosmicBackground } from '../../scene/CosmicBackground'
import { initSession, useSession } from '../../state/session'
import { hydratePreferences } from '../../state/preferences'
import { loadAvatar } from '../../state/avatar'

/**
 * Immersive full-screen layout for active gameplay — no site chrome, while
 * still hydrating session/avatar so the player's customized explorer appears in
 * the 3D biome diorama even on a direct load or refresh.
 */
export function GameLayout() {
  const session = useSession()

  useEffect(() => {
    void initSession()
  }, [])

  useEffect(() => {
    if (session.status === 'loading') return
    hydratePreferences(session.status === 'authed', session.preferences)
    void loadAvatar(session.status === 'authed')
  }, [session.status, session.user?.id, session.preferences])

  return (
    <div className="relative min-h-dvh">
      <CosmicBackground />
      <Outlet />
    </div>
  )
}
