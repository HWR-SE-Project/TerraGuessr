import { useSession } from '../../state/SessionContext'
import { AuthLandingPage } from '../auth/AuthLandingPage'
import { ScaledDesktopCanvas } from '../../components/ScaledDesktopCanvas'
import { DesktopHome } from './DesktopHome'
import { MobileHome } from './MobileHome'
import './HomePage.css'

export function HomePage() {
  const { status, user } = useSession()

  if (status === 'loading') {
    return <div className="tg-home-loading" aria-busy="true" />
  }

  if (!user) {
    return <AuthLandingPage />
  }

  return (
    <div className="tg-home-root">
      <div className="tg-home-desktop-slot">
        <ScaledDesktopCanvas>
          <DesktopHome />
        </ScaledDesktopCanvas>
      </div>
      <div className="tg-home-mobile-slot">
        <MobileHome />
      </div>
    </div>
  )
}
