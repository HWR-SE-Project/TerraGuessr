import { Outlet } from 'react-router-dom'
import { CosmicBackground } from '../../scene/CosmicBackground'

/** Immersive full-screen layout for active gameplay — no site chrome. */
export function GameLayout() {
  return (
    <div className="relative min-h-dvh">
      <CosmicBackground />
      <Outlet />
    </div>
  )
}
