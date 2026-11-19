import { DesktopHome } from './DesktopHome'
import { MobileHome } from './MobileHome'
import './HomePage.css'

export function HomePage() {
  return (
    <div className="tg-home-root">
      <div className="tg-home-desktop-slot">
        <DesktopHome />
      </div>
      <div className="tg-home-mobile-slot">
        <MobileHome />
      </div>
    </div>
  )
}
