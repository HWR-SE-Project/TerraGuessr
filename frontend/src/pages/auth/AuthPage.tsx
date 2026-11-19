import { DesktopAuth } from './DesktopAuth'
import { MobileAuth } from './MobileAuth'
import './tokens.css'
import './AuthPage.css'

export function AuthPage() {
  return (
    <div className="tg-auth-root">
      <div className="tg-auth-desktop-slot">
        <DesktopAuth />
      </div>
      <div className="tg-auth-mobile-slot">
        <MobileAuth />
      </div>
    </div>
  )
}
