import { AppHeader } from './components/layout/AppHeader'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './pages/home/HomePage'
import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CosmicBackground } from './scene/cosmic/CosmicBackground'
import { PageTransition } from './components/layout/PageTransition'

const AuthPage = lazy(() =>
  import('./pages/auth/AuthPage').then((m) => ({ default: m.AuthPage })),
)
const ResetPasswordPage = lazy(() =>
  import('./pages/auth/ResetPasswordPage').then((m) => ({
    default: m.ResetPasswordPage,
  })),
)
const VerifyEmailPage = lazy(() =>
  import('./pages/auth/VerifyEmailPage').then((m) => ({
    default: m.VerifyEmailPage,
  })),
)
const EmailChangePage = lazy(() =>
  import('./pages/auth/EmailChangePage').then((m) => ({
    default: m.EmailChangePage,
  })),
)
const SettingsPage = lazy(() =>
  import('./pages/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
)
const SingleplayerGamePage = lazy(() =>
  import('./pages/singleplayer/SingleplayerGamePage').then((m) => ({
    default: m.SingleplayerGamePage,
  })),
)
const HowToPlayPage = lazy(() =>
  import('./pages/how-to-play/HowToPlayPage').then((m) => ({ default: m.HowToPlayPage })),
)
const LobbyPage = lazy(() =>
  import('./pages/lobby/LobbyPage').then((m) => ({ default: m.LobbyPage })),
)
const MultiplayerGamePage = lazy(() =>
  import('./pages/lobby/MultiplayerGamePage').then((m) => ({
    default: m.MultiplayerGamePage,
  })),
)

function App() {
  const location = useLocation()
  const { pathname } = location
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Explore the World',
      '/auth': 'Your next adventure',
      '/multiplayer': 'Multiplayer',
      '/game/singleplayer': 'World Explorer',
      '/settings': 'Settings',
      '/how-to-play': 'How to play',
      '/reset-password': 'Reset password',
      '/verify-email': 'Verify email',
      '/confirm-email-change': 'Confirm email change',
    }
    const title =
      pathname.startsWith('/multiplayer') || pathname.startsWith('/lobby')
        ? 'Multiplayer'
        : (titles[pathname] ?? 'Explore the World')
    document.title = `${title} · TerraGuessr`
  }, [pathname])
  return (
    <CosmicBackground>
      <Suspense
        fallback={
          <><AppHeader /><div className="tg-route-loading" role="status">Finding your next discovery…</div></>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
            <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
            <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
            <Route path="/verify-email" element={<PageTransition><VerifyEmailPage /></PageTransition>} />
            <Route path="/confirm-email-change" element={<PageTransition><EmailChangePage /></PageTransition>} />
            <Route path="/multiplayer" element={<Navigate to="/multiplayer/create" replace />} />
            <Route path="/multiplayer/create" element={<PageTransition><LobbyPage /></PageTransition>} />
            <Route path="/multiplayer/join" element={<PageTransition><LobbyPage mode="join" /></PageTransition>} />
            <Route path="/lobby" element={<Navigate to="/multiplayer/create" replace />} />
            <Route path="/lobby/:code" element={<PageTransition><LobbyPage /></PageTransition>} />
            <Route path="/lobby/:code/game" element={<PageTransition><MultiplayerGamePage /></PageTransition>} />
            <Route path="/game/singleplayer" element={<PageTransition><SingleplayerGamePage /></PageTransition>} />
            <Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />
            <Route path="/how-to-play" element={<PageTransition><HowToPlayPage /></PageTransition>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </CosmicBackground>
  )
}
export default App
