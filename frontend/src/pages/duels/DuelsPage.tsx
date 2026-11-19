import { DesktopDuels } from './DesktopDuels'
import { MobileDuels } from './MobileDuels'
import './DuelsPage.css'

export function DuelsPage() {
  return (
    <div className="tg-duels-root">
      <div className="tg-duels-desktop-slot">
        <DesktopDuels />
      </div>
      <div className="tg-duels-mobile-slot">
        <MobileDuels />
      </div>
    </div>
  )
}
