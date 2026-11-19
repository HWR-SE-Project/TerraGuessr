import { ScaledDesktopCanvas } from '../../components/ScaledDesktopCanvas'
import { DesktopDuels } from './DesktopDuels'
import { MobileDuels } from './MobileDuels'
import './DuelsPage.css'

export function DuelsPage() {
  // Temporarily public, like the Home Page.
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
