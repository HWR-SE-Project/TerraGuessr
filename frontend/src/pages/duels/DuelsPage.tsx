import { useNavigate } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import { ScaledDesktopCanvas } from '../../components/ScaledDesktopCanvas'
import { DesktopDuels } from './DesktopDuels'
import { MobileDuels } from './MobileDuels'
import './DuelsPage.css'

export function DuelsPage() {
  const navigate = useNavigate()
  const { status, user } = useSession()

  if (status === 'loading') {
    return <div className="tg-duels-loading" aria-busy="true" />
  }

  if (!user) {
    return (
      <div className="tg-duels-signin-gate">
        <h1>Duels</h1>
        <p>Sign in to challenge a friend and show up on the leaderboard under your own name.</p>
        <button type="button" onClick={() => navigate('/auth')}>
          Sign in
        </button>
      </div>
    )
  }

  return (
    <div className="tg-duels-root">
      <div className="tg-duels-desktop-slot">
        <ScaledDesktopCanvas>
          <DesktopDuels />
        </ScaledDesktopCanvas>
      </div>
      <div className="tg-duels-mobile-slot">
        <MobileDuels />
      </div>
    </div>
  )
}
